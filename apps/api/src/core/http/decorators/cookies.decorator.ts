import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** Reads one cookie (or all of them) off the request. Requires cookie-parser — see main.ts. */
export const Cookies = createParamDecorator((data: string | undefined, ctx: ExecutionContext) => {
	// Express types `cookies` as `any`; narrowing it here keeps that `any` from leaking into
	// every handler that reads a cookie.
	const cookies = (ctx.switchToHttp().getRequest<Request>().cookies ?? {}) as Record<string, string | undefined>;
	return data ? cookies[data] : cookies;
});
