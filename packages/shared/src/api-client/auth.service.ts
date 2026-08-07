import type { LoginInput, ProfileUpdateInput, RegisterInput, SessionResponse } from "../types/auth";
import type { Requester } from "./http";

export function createAuthService({ request }: Requester) {
	return {
		register: (input: RegisterInput) =>
			request<SessionResponse>("/api/v1/auth/register", { method: "POST", body: JSON.stringify(input) }),
		login: (input: LoginInput) =>
			request<SessionResponse>("/api/v1/auth/login", { method: "POST", body: JSON.stringify(input) }),
		/**
		 * Rotates the cookie pair; the old refresh token is burned server-side on success.
		 * You rarely call this yourself — the client refreshes on its own after a 401.
		 */
		refresh: () => request<SessionResponse>("/api/v1/auth/refresh", { method: "POST" }),
		/** Revokes the whole token family and clears both cookies. */
		logout: () => request<null>("/api/v1/auth/logout", { method: "POST" }),
		me: () => request<SessionResponse>("/api/v1/auth/me"),
		/**
		 * Changing the password signs out every OTHER device; this tab gets a fresh cookie
		 * pair back, so nothing else has to be done here.
		 */
		updateProfile: (input: ProfileUpdateInput) =>
			request<SessionResponse>("/api/v1/auth/me", { method: "PATCH", body: JSON.stringify(input) }),
	};
}
