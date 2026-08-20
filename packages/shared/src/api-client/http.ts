import type { ApiErrorBody, ApiResponse } from '../types/api';

export interface ApiClientOptions {
	/** Prefix in front of every path. Empty when the frontend is proxied onto the same origin. */
	baseUrl: string;
	/**
	 * Called once when a request comes back 401 and the automatic refresh also fails — i.e. the
	 * session is really over. Wire it to your "redirect to /login" logic.
	 */
	onSessionExpired?: () => void;
}

export class ApiError extends Error {
	readonly status: number;
	readonly body: ApiErrorBody | undefined;

	constructor(status: number, body: ApiErrorBody | undefined) {
		super(body?.error ?? `api_error_${status}`);
		this.name = 'ApiError';
		this.status = status;
		this.body = body;
	}

	/** Field-level messages from a 400 validation failure, empty for anything else. */
	get details(): string[] {
		return this.body?.details ?? [];
	}
}

/**
 * What services receive: `request` unwraps the envelope and hands back the payload, while
 * `envelope` returns the whole `ApiResponse` for the endpoints whose `meta` matters
 * (pagination totals). Both share one cookie session and one refresh lock.
 */
export interface Requester {
	request: <T>(path: string, init?: RequestInit) => Promise<T>;
	envelope: <T>(path: string, init?: RequestInit) => Promise<ApiResponse<T>>;
}

/** Endpoints that must never trigger the automatic refresh: refreshing them IS the refresh. */
const NO_RETRY_PATHS = ['/api/v1/auth/refresh', '/api/v1/auth/login', '/api/v1/auth/logout'];

export function createRequester(options: ApiClientOptions): Requester {
	// Single-flight: a page that fires five requests at once must not fire five refreshes.
	// The first 401 starts the rotation, the other four await the same promise.
	let refreshing: Promise<boolean> | null = null;

	async function send(path: string, init: RequestInit): Promise<Response> {
		const headers = new Headers(init.headers);
		// Never set Content-Type for FormData — the browser has to add the multipart boundary
		// itself, and a fixed value makes the body unparseable.
		if (init.body !== undefined && !(init.body instanceof FormData)) {
			headers.set('Content-Type', 'application/json');
		}
		// The whole auth scheme is httpOnly cookies; without this they are simply not sent.
		return fetch(`${options.baseUrl}${path}`, { ...init, headers, credentials: 'include' });
	}

	async function refresh(): Promise<boolean> {
		refreshing ??= send('/api/v1/auth/refresh', { method: 'POST' })
			.then((res) => res.ok)
			.catch(() => false)
			.finally(() => {
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
		// Callers almost always want the payload, not the wrapper.
		request: async <T>(path: string, init?: RequestInit) => (await envelope<T>(path, init)).data as T,
	};
}
