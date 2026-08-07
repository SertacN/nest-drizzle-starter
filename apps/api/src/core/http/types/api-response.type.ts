/**
 * What a controller returns. The ResponseTransformInterceptor adds `success` and `timestamp`,
 * so no controller ever builds the envelope by hand.
 *
 * The client-side counterpart is `ApiResponse<T>` in `shared`.
 */
export interface ServiceResponse<TData = unknown> {
	/** Human-readable, for the frontend to show directly. Errors carry CODES instead. */
	message: string;
	data?: TData;
	meta?: Record<string, unknown>;
}
