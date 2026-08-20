/**
 * Every successful response leaves the API in this envelope — the ResponseTransformInterceptor
 * wraps whatever a controller returned. Errors use ApiErrorBody instead (AllExceptionsFilter).
 */
export interface ApiResponse<TData = unknown> {
	success: true;
	message: string;
	data?: TData;
	meta?: Record<string, unknown>;
	timestamp: string;
}

export interface ApiErrorBody {
	success: false;
	/** Stable error CODE, not prose — clients switch on it and translate it. */
	error: string;
	statusCode: number;
	/** Present on validation failures: one entry per rejected field. */
	details?: string[];
	timestamp: string;
}

/** Shape of `meta` on every paginated list endpoint. */
export interface PaginationMeta extends Record<string, unknown> {
	total: number;
	page: number;
	perPage: number;
	totalPages: number;
}

export interface PaginationQuery {
	page?: number;
	perPage?: number;
}
