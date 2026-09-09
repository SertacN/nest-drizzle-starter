import type { LoginInput, MobileProfileResponse, MobileSessionResponse, ProfileUpdateInput, RegisterInput, SessionResponse } from '../types/auth';
import type { Requester } from './http';
import { MOBILE_AUTH_PATH, type TokenStore } from './mobile-http';

/**
 * The mobile twin of `createAuthService`. Every call that produces a new pair writes it to the
 * store before returning, so a screen never has to remember to do it.
 *
 * `GET /auth/me` is NOT duplicated on the mobile surface — it issues no tokens, and the Bearer
 * header works against the shared endpoint.
 */
export function createMobileAuthService({ request }: Requester, tokens: TokenStore) {
	async function start(path: string, input: LoginInput | RegisterInput): Promise<MobileSessionResponse> {
		const session = await request<MobileSessionResponse>(path, { method: 'POST', body: JSON.stringify(input) });
		await tokens.write(session.tokens);
		return session;
	}

	return {
		register: (input: RegisterInput) => start(`${MOBILE_AUTH_PATH}/register`, input),
		login: (input: LoginInput) => start(`${MOBILE_AUTH_PATH}/login`, input),

		/**
		 * You rarely call this yourself — the client rotates on its own after a 401. It is here
		 * for the app-resume case, where refreshing once beats letting the first screen fail.
		 */
		refresh: async (): Promise<MobileSessionResponse | null> => {
			const stored = await tokens.read();
			if (!stored) return null;
			const session = await request<MobileSessionResponse>(`${MOBILE_AUTH_PATH}/refresh`, {
				method: 'POST',
				body: JSON.stringify({ refreshToken: stored.refreshToken }),
			});
			await tokens.write(session.tokens);
			return session;
		},

		/** Revokes the whole family server-side, then drops the pair locally either way. */
		logout: async (): Promise<void> => {
			const stored = await tokens.read();
			try {
				if (stored) {
					await request<null>(`${MOBILE_AUTH_PATH}/logout`, {
						method: 'POST',
						body: JSON.stringify({ refreshToken: stored.refreshToken }),
					});
				}
			} finally {
				// A failed request must never leave the user looking signed in. The server-side
				// row expires on its own if the call did not land.
				await tokens.write(null);
			}
		},

		me: () => request<SessionResponse>('/api/v1/auth/me'),

		/**
		 * Changing the password signs out every OTHER device and returns a fresh pair for this
		 * one, which is stored here. A name-only update returns `tokens: null`.
		 */
		updateProfile: async (input: ProfileUpdateInput): Promise<MobileProfileResponse> => {
			const result = await request<MobileProfileResponse>(`${MOBILE_AUTH_PATH}/me`, { method: 'PATCH', body: JSON.stringify(input) });
			if (result.tokens) await tokens.write(result.tokens);
			return result;
		},
	};
}
