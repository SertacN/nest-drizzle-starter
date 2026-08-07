import { createAuthService } from "./auth.service";
import { createExampleService } from "./example.service";
import { type ApiClientOptions, createRequester } from "./http";
import { createUploadsService } from "./uploads.service";

export { ApiError, type ApiClientOptions, type Requester } from "./http";

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
