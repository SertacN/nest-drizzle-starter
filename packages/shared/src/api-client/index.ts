import { createAuthService } from './auth.service';
import { createExampleService } from './example.service';
import { type ApiClientOptions, createRequester } from './http';
import { createMobileAuthService } from './mobile-auth.service';
import { createMobileRequester, type MobileApiClientOptions } from './mobile-http';
import { createUploadsService } from './uploads.service';

export { ApiError, type ApiClientOptions, type Requester } from './http';
export { MOBILE_AUTH_PATH, type MobileApiClientOptions, type TokenStore } from './mobile-http';

/**
 * Bundles every service into one client. The requester (baseUrl + cookie session + the
 * single-flight refresh lock) is built once and injected into each service — adding a resource
 * is a new `*.service.ts` plus one line here.
 *
 * Usage in a frontend:
 *   const api = createApiClient({ baseUrl: "", onSessionExpired: () => goto("/login") });
 *   const { items, meta } = await api.examples.list({ page: 1 });
 */
export function createApiClient(options: ApiClientOptions) {
	const requester = createRequester(options);

	return {
		auth: createAuthService(requester),
		examples: createExampleService(requester),
		uploads: createUploadsService(requester),
	};
}

export type ApiClient = ReturnType<typeof createApiClient>;

/**
 * The same client for a device: Bearer tokens out of a store you provide instead of cookies
 * the runtime keeps. Only `auth` differs — every other service is the exact same code, because
 * a resource service never knew how the session travelled in the first place.
 *
 * Usage in an app:
 *   const api = createMobileApiClient({
 *     baseUrl: "https://api.example.com",
 *     tokens: { read: readFromSecureStore, write: writeToSecureStore },
 *     onSessionExpired: () => navigation.reset({ routes: [{ name: "SignIn" }] }),
 *   });
 */
export function createMobileApiClient(options: MobileApiClientOptions) {
	const requester = createMobileRequester(options);

	return {
		auth: createMobileAuthService(requester, options.tokens),
		examples: createExampleService(requester),
		uploads: createUploadsService(requester),
	};
}

export type MobileApiClient = ReturnType<typeof createMobileApiClient>;
