import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import type { ApiResponse } from 'shared';
import type { ServiceResponse } from '../types';

/**
 * Wraps every successful response in the standard envelope. Controllers return
 * `{ message, data?, meta? }` and never build `success`/`timestamp` themselves — which is what
 * keeps the shape identical across the whole API.
 *
 * Errors do not pass through here; AllExceptionsFilter owns that side.
 */
@Injectable()
export class ResponseTransformInterceptor<TData> implements NestInterceptor<
	ServiceResponse<TData>,
	ApiResponse<TData>
> {
	intercept(
		_context: ExecutionContext,
		next: CallHandler<ServiceResponse<TData>>,
	): Observable<ApiResponse<TData>> {
		return next.handle().pipe(
			map((response) => ({
				success: true as const,
				...response,
				timestamp: new Date().toISOString(),
			})),
		);
	}
}
