import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { eq } from 'drizzle-orm';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ACCESS_TOKEN_COOKIE } from 'shared';
import { DRIZZLE, type Database } from '../../../core/db/drizzle.module';
import { users } from '../../../core/db/schema';
import type { AuthContext } from '../../../core/http/types';
import type { AccessPayload } from '../../../core/security/token.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
	constructor(
		config: ConfigService,
		@Inject(DRIZZLE) private readonly db: Database,
	) {
		super({
			// Two transports, one strategy. Cookie first: that is how the browser sends it.
			// The Bearer header is how a mobile app (and `curl`, and the Swagger "Authorize"
			// button) sends the very same access token — so every guarded endpoint serves
			// both audiences without knowing which one it is talking to.
			jwtFromRequest: ExtractJwt.fromExtractors([
				(req: Request) => (req.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined) ?? null,
				ExtractJwt.fromAuthHeaderAsBearerToken(),
			]),
			secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
		});
	}

	/**
	 * Runs on every authenticated request, so it is deliberately one indexed lookup by primary
	 * key. Hitting the DB rather than trusting the token alone is what makes deactivating a
	 * user take effect immediately instead of 15 minutes later.
	 *
	 * The returned object becomes `request.user` — see @GetUser.
	 */
	async validate(payload: AccessPayload): Promise<AuthContext> {
		if (payload.type !== 'access') throw new UnauthorizedException('unauthorized');

		const [user] = await this.db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
		if (!user || !user.isActive) throw new UnauthorizedException('unauthorized');

		return { id: user.id, email: user.email, name: user.name, role: user.role };
	}
}
