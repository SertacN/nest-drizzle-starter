import { SetMetadata } from '@nestjs/common';
import type { UserRole } from 'shared';

export const ROLES_KEY = 'roles';

/**
 * Marks a handler (or a whole controller) as role-gated. Mount RolesGuard AFTER JwtGuard —
 * the role comes from the verified token, never from the request body:
 *
 *   @UseGuards(JwtGuard, RolesGuard)
 *   @Roles('admin')
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
