import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { UserRole } from 'shared';
import { ROLES_KEY } from '../decorators';
import type { AuthContext } from '../types';

/**
 * Role gate. Mount AFTER JwtGuard — the role comes from the verified token, never from the
 * request body. Roles are cached in the access token for its whole lifetime (15 min by
 * default), so a demotion takes effect on the next refresh; that is the trade for not hitting
 * the database on every single request.
 */
@Injectable()
export class RolesGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
		// No @Roles on the route: this guard has nothing to say. JwtGuard still applies.
		if (!requiredRoles || requiredRoles.length === 0) return true;

		const user = context.switchToHttp().getRequest<Request & { user?: AuthContext }>().user;
		// Reaching here without a user means the guard order is wrong. Fail closed.
		if (!user) throw new ForbiddenException('forbidden');

		if (!requiredRoles.includes(user.role)) throw new ForbiddenException('forbidden');
		return true;
	}
}
