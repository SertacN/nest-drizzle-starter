import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

/** Anything slower than this is abnormal and gets logged even when it SUCCEEDED. */
const SLOW_REQUEST_MS = 3000;

@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
	constructor(@Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService) {}

	use(req: Request, res: Response, next: NextFunction): void {
		const startedAt = process.hrtime.bigint();

		res.on('finish', () => {
			const ms = Number((process.hrtime.bigint() - startedAt) / 1_000_000n);
			// The query string is dropped on purpose: tokens and reset codes end up there.
			const path = req.originalUrl.split('?')[0];
			const line = `${req.method} ${path} ${res.statusCode} +${ms}ms`;

			// 4xx/5xx are already logged with full context by AllExceptionsFilter; repeating
			// them here would double every error in the file.
			if (res.statusCode >= 400) return;

			if (ms >= SLOW_REQUEST_MS) this.logger.warn?.(`SLOW ${line}`, 'HTTP');
			else this.logger.log?.(line, 'HTTP');
		});

		next();
	}
}
