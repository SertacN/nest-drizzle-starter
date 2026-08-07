import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { UserRole } from 'shared';
import { durationToMs } from '../utils/duration.util';

export interface AccessPayload {
	/** user id */
	sub: string;
	role: UserRole;
	type: 'access';
}

export interface RefreshPayload {
	sub: string;
	role: UserRole;
	/** refresh_tokens.id — refresh tokens are tracked in the DB (rotation + reuse detection). */
	jti: string;
	type: 'refresh';
}

/**
 * Signing and verifying tokens is infrastructure, not a feature — the WebSocket gateway needs
 * it just as much as the auth module does, and core must never import a module.
 *
 * Access and refresh live in separate secret universes AND carry a `type` claim, so a refresh
 * token cannot be replayed where an access token is expected even if someone sets both secrets
 * to the same value (env validation already refuses that, this is the second lock).
 */
@Injectable()
export class TokenService {
	constructor(
		private readonly jwt: JwtService,
		private readonly config: ConfigService,
	) {}

	signAccessToken(payload: Omit<AccessPayload, 'type'>): Promise<string> {
		return this.jwt.signAsync(
			{ ...payload, type: 'access' },
			{
				secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
				expiresIn: this.ttlSeconds('JWT_ACCESS_EXPIRES_IN'),
			},
		);
	}

	signRefreshToken(payload: Omit<RefreshPayload, 'type'>): Promise<string> {
		return this.jwt.signAsync(
			{ ...payload, type: 'refresh' },
			{
				secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
				expiresIn: this.ttlSeconds('JWT_REFRESH_EXPIRES_IN'),
			},
		);
	}

	/** Throws if the token is invalid, expired, or of the wrong type. */
	async verifyAccessToken(token: string): Promise<AccessPayload> {
		const payload = await this.jwt.verifyAsync<AccessPayload>(token, {
			secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
		});
		if (payload.type !== 'access') throw new Error('unexpected_token_type');
		return payload;
	}

	async verifyRefreshToken(token: string): Promise<RefreshPayload> {
		const payload = await this.jwt.verifyAsync<RefreshPayload>(token, {
			secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
		});
		if (payload.type !== 'refresh') throw new Error('unexpected_token_type');
		if (!payload.jti) throw new Error('missing_jti');
		return payload;
	}

	/**
	 * Seconds, not the raw '15m' string: jsonwebtoken's own type for that string is narrower
	 * than `string`, and converting here keeps the token's expiry and the cookie's Max-Age
	 * derived from the exact same env value.
	 */
	private ttlSeconds(key: string): number {
		return durationToMs(this.config.getOrThrow<string>(key)) / 1000;
	}
}
