import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from 'shared';
import { durationToMs } from '../../../core/utils/duration.util';

/** Both cookies live under this path, so /refresh and /logout can each read the refresh token. */
const REFRESH_COOKIE_PATH = '/api/v1/auth';

function baseOptions(config: ConfigService): CookieOptions {
	const isProduction = config.get<string>('NODE_ENV') === 'production';
	return {
		// The whole point of the scheme: JavaScript cannot read these, so an XSS bug cannot
		// walk off with the session.
		httpOnly: true,
		// Over plain HTTP in development the browser would drop a Secure cookie entirely.
		secure: isProduction,
		// 'lax' still sends the cookie on top-level navigations (an email link back into the
		// app) while blocking the cross-site POSTs that CSRF needs.
		sameSite: 'lax',
	};
}

export function setAuthCookies(
	res: Response,
	tokens: { accessToken: string; refreshToken: string },
	config: ConfigService,
): void {
	const options = baseOptions(config);

	res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
		...options,
		path: '/',
		// Max-Age comes from the same env value the JWT's own expiry does — set them apart and
		// you eventually get a cookie that outlives its token, or the reverse.
		maxAge: durationToMs(config.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN')),
	});

	// Scoped to the auth routes: no other endpoint has any reason to receive it, and a cookie
	// that is not sent cannot leak in a log or a proxy.
	res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
		...options,
		path: REFRESH_COOKIE_PATH,
		maxAge: durationToMs(config.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN')),
	});
}

/**
 * Path and the other attributes must match what was set, or the browser keeps the original
 * cookie alongside the cleared one and the user stays signed in.
 */
export function clearAuthCookies(res: Response, config: ConfigService): void {
	const options = baseOptions(config);
	res.clearCookie(ACCESS_TOKEN_COOKIE, { ...options, path: '/' });
	res.clearCookie(REFRESH_TOKEN_COOKIE, { ...options, path: REFRESH_COOKIE_PATH });
}
