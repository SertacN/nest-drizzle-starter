import type { UserRole } from "../constants/auth";

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
