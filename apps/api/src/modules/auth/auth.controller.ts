import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Patch,
	Post,
	Res,
	UnauthorizedException,
	UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { REFRESH_TOKEN_COOKIE, type AuthUser } from 'shared';
import { Cookies, GetUser } from '../../core/http/decorators';
import type { ServiceResponse } from '../../core/http/types';
import { AuthService, type IssuedSession } from './auth.service';
import { clearAuthCookies, setAuthCookies } from './common';
import { LoginDto, RegisterDto, SessionResponseDto, UpdateProfileDto } from './dto';
import { JwtGuard } from './guard';

/**
 * Tokens never appear in a response body — they are set as httpOnly cookies the browser sends
 * on its own. What comes back is only who you now are.
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
	constructor(
		private readonly authService: AuthService,
		private readonly config: ConfigService,
	) {}

	// ---- anonymous -------------------------------------------------------------------------
	// Public and guessable, so the throttles here are much tighter than the global default.

	@Post('register')
	@Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
	@ApiOperation({ summary: 'Create an account and start a session' })
	@ApiResponse({ status: 201, type: SessionResponseDto })
	@ApiResponse({ status: 409, description: 'email_taken' })
	async register(
		@Body() dto: RegisterDto,
		@Res({ passthrough: true }) res: Response,
	): Promise<ServiceResponse<{ user: AuthUser }>> {
		return this.startSession(res, await this.authService.register(dto), 'Account created');
	}

	@Post('login')
	@HttpCode(HttpStatus.OK)
	@Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
	@ApiOperation({ summary: 'Start a session' })
	@ApiResponse({ status: 200, type: SessionResponseDto })
	@ApiResponse({ status: 401, description: 'invalid_credentials' })
	async login(
		@Body() dto: LoginDto,
		@Res({ passthrough: true }) res: Response,
	): Promise<ServiceResponse<{ user: AuthUser }>> {
		return this.startSession(res, await this.authService.login(dto), 'Signed in');
	}

	/**
	 * Rotates the cookie pair. Not guessable the way /login is, and every open tab hits it once
	 * per access-token lifetime while a whole office shares one NAT IP — hence a far wider
	 * budget than the other two. A 429 here signs people out for no reason.
	 */
	@Post('refresh')
	@HttpCode(HttpStatus.OK)
	@Throttle({ default: { limit: 100, ttl: 15 * 60_000 } })
	@ApiOperation({ summary: 'Rotate the token pair using the refresh cookie' })
	@ApiResponse({ status: 200, type: SessionResponseDto })
	@ApiResponse({ status: 401, description: 'invalid_refresh_token' })
	async refresh(
		@Cookies(REFRESH_TOKEN_COOKIE) refreshToken: string | undefined,
		@Res({ passthrough: true }) res: Response,
	): Promise<ServiceResponse<{ user: AuthUser }>> {
		if (!refreshToken) throw new UnauthorizedException('invalid_refresh_token');
		return this.startSession(
			res,
			await this.authService.refreshSession(refreshToken),
			'Session refreshed',
		);
	}

	/** Unauthenticated on purpose: signing out must work even with a dead access token. */
	@Post('logout')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Revoke the whole token family and clear both cookies' })
	async logout(
		@Cookies(REFRESH_TOKEN_COOKIE) refreshToken: string | undefined,
		@Res({ passthrough: true }) res: Response,
	): Promise<ServiceResponse<null>> {
		await this.authService.logout(refreshToken);
		clearAuthCookies(res, this.config);
		return { message: 'Signed out', data: null };
	}

	// ---- authenticated ---------------------------------------------------------------------

	@Get('me')
	@UseGuards(JwtGuard)
	@ApiCookieAuth()
	@ApiOperation({ summary: 'The signed-in user' })
	@ApiResponse({ status: 200, type: SessionResponseDto })
	async getMe(@GetUser('id') userId: string): Promise<ServiceResponse<{ user: AuthUser }>> {
		return { message: 'Profile loaded', data: { user: await this.authService.getProfile(userId) } };
	}

	/**
	 * Changing the password signs out every OTHER device and hands THIS one a fresh pair, so
	 * the tab that made the request keeps working.
	 */
	@Patch('me')
	@UseGuards(JwtGuard)
	@ApiCookieAuth()
	@ApiOperation({ summary: 'Update own name and/or password' })
	@ApiResponse({ status: 200, type: SessionResponseDto })
	@ApiResponse({ status: 400, description: 'invalid_current_password' })
	async updateMe(
		@GetUser('id') userId: string,
		@Body() dto: UpdateProfileDto,
		@Res({ passthrough: true }) res: Response,
	): Promise<ServiceResponse<{ user: AuthUser }>> {
		const { user, session } = await this.authService.updateOwnProfile(userId, dto);
		if (session) setAuthCookies(res, session, this.config);
		return { message: 'Profile updated', data: { user } };
	}

	/** The one place cookies are written, so no endpoint can forget an attribute. */
	private startSession(res: Response, session: IssuedSession, message: string) {
		setAuthCookies(res, session, this.config);
		return { message, data: { user: session.user } };
	}
}
