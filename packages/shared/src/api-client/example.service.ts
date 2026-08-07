import type { PaginationMeta } from "../types/api";
import type {
	Example,
	ExampleCreateInput,
	ExampleListQuery,
	ExampleUpdateInput,
	PublicExample,
} from "../types/example";
import type { Requester } from "./http";

function toQuery(params: Record<string, string | number | undefined>): string {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined) search.set(key, String(value));
	}
	const qs = search.toString();
	return qs ? `?${qs}` : "";
}

export function createExampleService({ request, envelope }: Requester) {
	return {
		/** Returns the rows AND the pagination totals — the only place `meta` is unwrapped. */
		list: async (query: ExampleListQuery = {}) => {
			const res = await envelope<Example[]>(`/api/v1/examples${toQuery({ ...query })}`);
			return { items: res.data ?? [], meta: res.meta as unknown as PaginationMeta };
		},
		get: (id: string) => request<Example>(`/api/v1/examples/${id}`),
		create: (input: ExampleCreateInput) =>
			request<Example>("/api/v1/examples", { method: "POST", body: JSON.stringify(input) }),
		update: (id: string, input: ExampleUpdateInput) =>
			request<Example>(`/api/v1/examples/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
		/** Soft delete — the row stays, `is_active` flips to false. */
		remove: (id: string) => request<null>(`/api/v1/examples/${id}`, { method: "DELETE" }),
		/** Anonymous surface: published rows only, no session needed. */
		listPublished: () => request<PublicExample[]>("/api/v1/public/examples"),
	};
}
