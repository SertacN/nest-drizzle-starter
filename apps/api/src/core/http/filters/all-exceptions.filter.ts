import {
	ArgumentsHost,
	Catch,
	ExceptionFilter,
	HttpException,
	HttpStatus,
	Inject,
	type LoggerService,
} from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import type { Request, Response } from 'express';
import type { ApiErrorBody } from 'shared';

/**
 * Everything that leaves the API as an error goes through here, so the body shape is the same
 * whether a service threw, a DTO failed validation, or something blew up unexpectedly.
 *
 * `error` is a stable CODE (`invalid_credentials`, `example_not_found`) — clients switch on it
 * and translate it. Free-form prose belongs in `details`, never in `error`.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
	constructor(@Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService) {}

	catch(exception: unknown, host: ArgumentsHost): void {
		const ctx = host.switchToHttp();
		const request = ctx.getRequest<Request>();
		const response = ctx.getResponse<Response>();

		const status =
			exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
		const { error, details } = describe(exception, status);

		// The query string is dropped on purpose: tokens and reset codes end up there.
		const meta = { status, method: request.method, path: request.originalUrl.split('?')[0] };

		if (status >= 500) {
			this.logger.error('Unhandled exception', {
				...meta,
				message: exception instanceof Error ? exception.message : String(exception),
				stack: exception instanceof Error ? exception.stack : undefined,
			});
		} else if (status === 401 || status === 403) {
			// Auth failures are a brute-force trail — kept separate from ordinary 4xx noise.
			this.logger.warn?.('Auth failure', { ...meta, error, ip: request.ip });
		} else if (status >= 400) {
			this.logger.warn?.(`Client error ${status}`, { ...meta, error });
		}

		const body: ApiErrorBody = {
			success: false,
			error,
			statusCode: status,
			...(details.length > 0 ? { details } : {}),
			timestamp: new Date().toISOString(),
		};
		response.status(status).json(body);
	}
}

/**
 * Turns whatever was thrown into a code + field messages.
 *
 * A 500 NEVER leaks its message: the text may carry a connection string or a SQL fragment.
 * The real reason is in the log, keyed by the same timestamp.
 */
function describe(exception: unknown, status: number): { error: string; details: string[] } {
	if (status >= 500) return { error: 'internal_server_error', details: [] };

	if (exception instanceof HttpException) {
		const payload = exception.getResponse();
		if (typeof payload === 'string') return { error: payload, details: [] };

		const record = payload as { message?: string | string[]; error?: string };
		// ValidationPipe produces `message: string[]` — one entry per rejected field.
		if (Array.isArray(record.message)) {
			return { error: 'validation_error', details: record.message };
		}
		return { error: record.message ?? record.error ?? 'error', details: [] };
	}

	return { error: 'error', details: [] };
}
