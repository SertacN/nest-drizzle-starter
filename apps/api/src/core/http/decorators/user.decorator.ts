import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthContext } from '../types';

/**
 * Pulls the authenticated user off the request. Only meaningful behind JwtGuard — without it
 * `request.user` is undefined and every handler would have to null-check.
 *
 *   getMe(@GetUser('id') userId: string)
 *   getMe(@GetUser() user: AuthContext)
 */
export const GetUser = createParamDecorator(
	<K extends keyof AuthContext>(data: K | undefined, ctx: ExecutionContext) => {
		const user = ctx.switchToHttp().getRequest<Request & { user?: AuthContext }>().user;
		if (!user) return null;
		return data ? user[data] : user;
	},
);
