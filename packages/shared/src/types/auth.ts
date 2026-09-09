import type { UserRole } from '../constants/auth';

/**
 * The only user shape that ever leaves the API. Password hashes and token columns are not in
 * it by construction, so no endpoint can leak them by forgetting to strip a field.
 */
export interface AuthUser {
	id: string;
	email: string;
	name: string;
	role: UserRole;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface RegisterInput {
	email: string;
	password: string;
	name: string;
}

export interface LoginInput {
	email: string;
	password: string;
}

export interface ProfileUpdateInput {
	name?: string;
	/** Required whenever `newPassword` is set — the API enforces this too. */
	currentPassword?: string;
	newPassword?: string;
}

/**
 * Login/register/refresh return no tokens: they are set as httpOnly cookies the browser
 * cannot read. The body only carries who you now are.
 */
export interface SessionResponse {
	user: AuthUser;
}

/**
 * A mobile app has no cookie jar, so its endpoints hand the pair back in the body and the app
 * stores it itself (the refresh token in the Keychain / Keystore, not in plain storage).
 * Everything behind the transport is identical to the web surface — same rows, same rotation,
 * same reuse detection.
 */
export interface MobileTokens {
	accessToken: string;
	refreshToken: string;
}

export interface MobileSessionResponse {
	user: AuthUser;
	tokens: MobileTokens;
}

/**
 * `tokens` is filled ONLY when the password changed: that revokes every other device and hands
 * this one a fresh pair, which the app must store in place of the old one. A name-only update
 * leaves it null and the stored pair stays valid.
 */
export interface MobileProfileResponse {
	user: AuthUser;
	tokens: MobileTokens | null;
}

export interface RefreshTokenInput {
	refreshToken: string;
}
