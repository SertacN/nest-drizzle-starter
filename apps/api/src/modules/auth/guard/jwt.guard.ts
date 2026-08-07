import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Requires a valid access token. Everything behind it can rely on `request.user`.
 *
 * The override exists to normalise the failure: passport's default message is prose that
 * varies by cause ('No auth token', 'jwt expired'), and clients switch on stable CODES.
 */
@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
	handleRequest<TUser>(err: unknown, user: TUser, _info: unknown, _ctx: ExecutionContext): TUser {
		if (err || !user) throw new UnauthorizedException('unauthorized');
		return user;
	}
}
