import type { ApiErrorBody, ApiResponse } from '../types/api';
import type { MobileSessionResponse, MobileTokens } from '../types/auth';
import { ApiError, type Requester } from './http';

/**
 * Where the app keeps the pair. There is no httpOnly anything on a device, so this is the one
 * decision the client cannot make for you: the refresh token belongs in the Keychain /
 * Keystore (expo-secure-store, react-native-keychain), the access token may live in memory.
 * Both sync and async implementations work.
 */
export interface TokenStore {
	read: () => MobileTokens | null | Promise<MobileTokens | null>;
	write: (tokens: MobileTokens | null) => void | Promise<void>;
}

export interface MobileApiClientOptions {
	/** Absolute — a device is never on the same origin as the API. */
	baseUrl: string;
	tokens: TokenStore;
	/**
	 * Called once when a request comes back 401 and the rotation also fails — the refresh
	 * family is gone and the stored pair has already been cleared. Wire it to your
	 * "go back to the login screen" logic.
	 */
	onSessionExpired?: () => void;
}

export const MOBILE_AUTH_PATH = '/api/v1/auth/mobile';

/** Rotating IS the refresh, and a failed login must not trigger one. */
const NO_RETRY_PATHS = [`${MOBILE_AUTH_PATH}/refresh`, `${MOBILE_AUTH_PATH}/login`, `${MOBILE_AUTH_PATH}/register`, `${MOBILE_AUTH_PATH}/logout`];

/**
 * The cookie client's twin: same envelope handling, same single-flight refresh, but the token
 * travels in an Authorization header and the rotation posts the refresh token as a body.
 */
export function createMobileRequester(options: MobileApiClientOptions): Requester {
	// A screen that fires five requests at once must not fire five rotations — the first 401
	// starts one and the other four await the same promise.
	let refreshing: Promise<boolean> | null = null;

	async function send(path: string, init: RequestInit): Promise<Response> {
		const headers = new Headers(init.headers);
		// Never set Content-Type for FormData — the runtime has to add the multipart boundary
		// itself, and a fixed value makes the body unparseable.
		if (init.body !== undefined && !(init.body instanceof FormData)) {
			headers.set('Content-Type', 'application/json');
		}
		const stored = await options.tokens.read();
		if (stored) headers.set('Authorization', `Bearer ${stored.accessToken}`);
		// No `credentials: 'include'`: there is no cookie jar to include.
		return fetch(`${options.baseUrl}${path}`, { ...init, headers });
	}

	async function rotate(): Promise<boolean> {
		const stored = await options.tokens.read();
		if (!stored) return false;

		let res: Response;
		try {
			res = await fetch(`${options.baseUrl}${MOBILE_AUTH_PATH}/refresh`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ refreshToken: stored.refreshToken }),
			});
		} catch {
			// A dead network is not a dead session — a phone goes through tunnels. Keep the
			// pair and let the next attempt try again.
			return false;
		}

		// The server rejected the token itself: the family is revoked or expired and no retry
		// will ever fix it, so stop sending a pair that cannot work.
		if (!res.ok) {
			await options.tokens.write(null);
			return false;
		}

		const body = (await res.json().catch(() => undefined)) as ApiResponse<MobileSessionResponse> | undefined;
		if (!body?.data) return false;
		await options.tokens.write(body.data.tokens);
		return true;
	}

	async function refresh(): Promise<boolean> {
		refreshing ??= rotate().finally(() => {
			refreshing = null;
		});
		return refreshing;
	}

	async function envelope<T>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
		let res = await send(path, init);

		// An expired access token is routine, not a failure: rotate once and replay. Retrying
		// more than once would turn a revoked family into an infinite loop.
		if (res.status === 401 && !NO_RETRY_PATHS.includes(path)) {
			if (await refresh()) {
				res = await send(path, init);
			} else {
				options.onSessionExpired?.();
			}
		}

		const body = (await res.json().catch(() => undefined)) as ApiResponse<T> | ApiErrorBody | undefined;
		if (!res.ok) throw new ApiError(res.status, body as ApiErrorBody | undefined);
		return body as ApiResponse<T>;
	}

	return {
		envelope,
		request: async <T>(path: string, init?: RequestInit) => (await envelope<T>(path, init)).data as T,
	};
}
