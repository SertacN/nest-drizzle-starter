import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Inject,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { and, eq, isNull, lt } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { AuthUser } from 'shared';
import { DRIZZLE, type Database } from '../../core/db/drizzle.module';
import { refreshTokens, users, type UserRow } from '../../core/db/schema';
import { TokenService } from '../../core/security/token.service';
import { durationToMs } from '../../core/utils/duration.util';
import { hashPassword, verifyPassword } from '../../core/utils/password.util';
import { ConfigService } from '@nestjs/config';
import { isWithinReuseGrace } from './common';
import type { LoginDto, RegisterDto, UpdateProfileDto } from './dto';

export interface IssuedSession {
	user: AuthUser;
	accessToken: string;
	refreshToken: string;
}

/**
 * The ONLY layer that talks to the database for auth. Controllers hand it DTOs and put the
 * returned tokens into cookies; they never build a query themselves.
 */
@Injectable()
export class AuthService {
	constructor(
		@Inject(DRIZZLE) private readonly db: Database,
		private readonly tokenService: TokenService,
		private readonly config: ConfigService,
	) {}

	async register(dto: RegisterDto): Promise<IssuedSession> {
		const [existing] = await this.db.select().from(users).where(eq(users.email, dto.email)).limit(1);
		// Deliberately explicit: this endpoint is public, so an attacker can enumerate addresses
		// either way (the alternative is silently mailing the existing owner). If that matters
		// for your product, return 201 unconditionally and send a verification mail instead.
		if (existing) throw new ConflictException('email_taken');

		const [user] = await this.db
			.insert(users)
			.values({
				email: dto.email,
				name: dto.name,
				passwordHash: await hashPassword(dto.password),
			})
			.returning();

		return this.issueSession(user, randomUUID());
	}

	async login(dto: LoginDto): Promise<IssuedSession> {
		const [user] = await this.db.select().from(users).where(eq(users.email, dto.email)).limit(1);

		// The same error for "no such user" and "wrong password" — never leak which one it was.
		// verifyPassword still runs on a miss so the response time does not give it away either.
		const passwordHash = user?.passwordHash ?? DUMMY_HASH;
		const passwordOk = await verifyPassword(dto.password, passwordHash);
		if (!user || !passwordOk) throw new UnauthorizedException('invalid_credentials');
		if (!user.isActive) throw new ForbiddenException('account_disabled');

		// Opportunistic cleanup: drop this user's expired token rows while we are here.
		await this.db
			.delete(refreshTokens)
			.where(and(eq(refreshTokens.userId, user.id), lt(refreshTokens.expiresAt, new Date())));

		return this.issueSession(user, randomUUID());
	}

	async getProfile(userId: string): Promise<AuthUser> {
		const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
		if (!user) throw new UnauthorizedException('unauthorized');
		return toAuthUser(user);
	}

	/**
	 * Rotation + reuse detection. The old token is burned and a new pair is issued; a token that
	 * comes back after it was already spent is treated as stolen and takes its whole family down.
	 */
	async refreshSession(refreshToken: string): Promise<IssuedSession> {
		let payload;
		try {
			payload = await this.tokenService.verifyRefreshToken(refreshToken);
		} catch {
			throw new UnauthorizedException('invalid_refresh_token');
		}

		const now = new Date();
		// Atomic claim: used_at is stamped only if the row is still unused and unrevoked, so of
		// two requests racing with the same token exactly one wins.
		const [claimed] = await this.db
			.update(refreshTokens)
			.set({ usedAt: now })
			.where(
				and(
					eq(refreshTokens.id, payload.jti),
					isNull(refreshTokens.usedAt),
					isNull(refreshTokens.revokedAt),
				),
			)
			.returning();

		const [user] = await this.db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
		if (!user || !user.isActive) throw new UnauthorizedException('invalid_refresh_token');

		if (!claimed) {
			// The row is either missing (forged or pruned) or already used/revoked.
			const [existing] = await this.db
				.select()
				.from(refreshTokens)
				.where(eq(refreshTokens.id, payload.jti))
				.limit(1);
			if (!existing) throw new UnauthorizedException('invalid_refresh_token');

			// Grace window: a token handed out seconds ago is usually a race (a retried request,
			// a second tab that missed the rotation), not theft. The family survives and a new
			// pair from the same family is issued. Replays after the window still count as theft.
			if (isWithinReuseGrace(existing, now)) {
				return this.issueSession(user, existing.familyId);
			}

			await this.revokeFamily(existing.familyId);
			throw new UnauthorizedException('invalid_refresh_token');
		}

		if (claimed.expiresAt < now) throw new UnauthorizedException('invalid_refresh_token');

		return this.issueSession(user, claimed.familyId);
	}

	/** Idempotent: an invalid token is not an error, there is simply nothing to revoke. */
	async logout(refreshToken: string | undefined): Promise<void> {
		if (!refreshToken) return;
		let payload;
		try {
			payload = await this.tokenService.verifyRefreshToken(refreshToken);
		} catch {
			return;
		}
		const [row] = await this.db
			.select()
			.from(refreshTokens)
			.where(eq(refreshTokens.id, payload.jti))
			.limit(1);
		if (row) await this.revokeFamily(row.familyId);
	}

	/**
	 * The user's own name / password.
	 *
	 * Changing a password revokes ALL of the user's refresh tokens — but that would also kill
	 * the tab making the request, whose access token could not be refreshed 15 minutes later.
	 * So the caller gets a FRESH pair back: other devices are signed out, this session stays.
	 */
	async updateOwnProfile(
		userId: string,
		dto: UpdateProfileDto,
	): Promise<{ user: AuthUser; session: IssuedSession | null }> {
		const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
		if (!user) throw new UnauthorizedException('unauthorized');

		if (dto.newPassword) {
			// The DTO already requires currentPassword alongside newPassword; this is the check
			// that actually matters, and it lives here so no future caller can skip it.
			const ok = await verifyPassword(dto.currentPassword ?? '', user.passwordHash);
			if (!ok) throw new BadRequestException('invalid_current_password');
		}

		const [updated] = await this.db
			.update(users)
			.set({
				...(dto.name ? { name: dto.name } : {}),
				...(dto.newPassword ? { passwordHash: await hashPassword(dto.newPassword) } : {}),
				updatedAt: new Date(),
			})
			.where(eq(users.id, userId))
			.returning();

		if (!dto.newPassword) return { user: toAuthUser(updated), session: null };

		await this.revokeAllForUser(userId);
		const session = await this.issueSession(updated, randomUUID());
		return { user: session.user, session };
	}

	/** Opens one row per refresh token; `familyId` ties a whole login session together. */
	private async issueSession(user: UserRow, familyId: string): Promise<IssuedSession> {
		const jti = randomUUID();
		const ttlMs = durationToMs(this.config.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN'));

		await this.db.insert(refreshTokens).values({
			id: jti,
			userId: user.id,
			familyId,
			expiresAt: new Date(Date.now() + ttlMs),
		});

		const [accessToken, refreshToken] = await Promise.all([
			this.tokenService.signAccessToken({ sub: user.id, role: user.role }),
			this.tokenService.signRefreshToken({ sub: user.id, role: user.role, jti }),
		]);

		return { user: toAuthUser(user), accessToken, refreshToken };
	}

	private async revokeFamily(familyId: string): Promise<void> {
		await this.db
			.update(refreshTokens)
			.set({ revokedAt: new Date() })
			.where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
	}

	private async revokeAllForUser(userId: string): Promise<void> {
		await this.db
			.update(refreshTokens)
			.set({ revokedAt: new Date() })
			.where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
	}
}

/**
 * A valid bcrypt hash of a value nobody knows. Compared against when the email does not exist,
 * so a miss costs the same ~250ms as a hit and the response time stops being an oracle for
 * "this address has an account".
 */
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO3aQ8pTfBgNfeUyVYAZzcuQKAHYPvXKe';

/** The only user shape that leaves the API — password hashes cannot escape through it. */
function toAuthUser(user: UserRow): AuthUser {
	return {
		id: user.id,
		email: user.email,
		name: user.name,
		role: user.role,
		isActive: user.isActive,
		createdAt: user.createdAt.toISOString(),
		updatedAt: user.updatedAt.toISOString(),
	};
}
