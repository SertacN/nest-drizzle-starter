import type { UserRole } from 'shared';

/**
 * What the JWT strategy puts on `request.user` — deliberately NOT the whole DB row, so a
 * controller cannot accidentally serialize a password hash it never asked for.
 */
export interface AuthContext {
	id: string;
	email: string;
	name: string;
	role: UserRole;
}
