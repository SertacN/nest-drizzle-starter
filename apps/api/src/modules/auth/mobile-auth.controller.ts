import { Body, Controller, HttpCode, HttpStatus, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { MobileProfileResponse, MobileSessionResponse } from 'shared';
import { GetUser } from '../../core/http/decorators';
import type { ServiceResponse } from '../../core/http/types';
import { AuthService, type IssuedSession } from './auth.service';
import { LoginDto, MobileProfileResponseDto, MobileSessionResponseDto, RefreshTokenDto, RegisterDto, UpdateProfileDto } from './dto';
import { JwtGuard } from './guard';

/**
 * The same session machinery as `AuthController`, for callers with no cookie jar.
 *
 * A device cannot hold an httpOnly cookie, so here the pair travels in the body and the app
 * stores it — the refresh token in the Keychain / Keystore. Nothing BEHIND the transport
 * changes: one `AuthService`, one `refresh_tokens` table, the same rotation, reuse detection
 * and family revoke. Only the two ends of the wire differ.
 *
 * `GET /auth/me` is deliberately not duplicated here — it issues no tokens, and `JwtStrategy`
 * already accepts a Bearer header on the shared endpoint.
 */
@ApiTags('Auth (mobile)')
@Controller('auth/mobile')
export class MobileAuthController {
	constructor(private readonly authService: AuthService) {}

	// ---- anonymous -------------------------------------------------------------------------
	// Public and guessable, so these carry the same tight throttles as their web twins.

	@Post('register')
	@Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
	@ApiOperation({ summary: 'Create an account and get a token pair' })
	@ApiResponse({ status: 201, type: MobileSessionResponseDto })
	@ApiResponse({ status: 409, description: 'email_taken' })
	async register(@Body() dto: RegisterDto): Promise<ServiceResponse<MobileSessionResponse>> {
		return this.session(await this.authService.register(dto), 'Account created');
	}

	@Post('login')
	@HttpCode(HttpStatus.OK)
	@Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
	@ApiOperation({ summary: 'Sign in and get a token pair' })
	@ApiResponse({ status: 200, type: MobileSessionResponseDto })
	@ApiResponse({ status: 401, description: 'invalid_credentials' })
	async login(@Body() dto: LoginDto): Promise<ServiceResponse<MobileSessionResponse>> {
		return this.session(await this.authService.login(dto), 'Signed in');
	}

	/**
	 * Rotates the pair. Every screen behind a resumed app hits this at once when the access
	 * token has aged out, and a whole café shares one NAT IP — hence the wide budget. A 429
	 * here signs people out for no reason.
	 */
	@Post('refresh')
	@HttpCode(HttpStatus.OK)
	@Throttle({ default: { limit: 100, ttl: 15 * 60_000 } })
	@ApiOperation({ summary: 'Rotate the token pair' })
	@ApiResponse({ status: 200, type: MobileSessionResponseDto })
	@ApiResponse({ status: 401, description: 'invalid_refresh_token' })
	async refresh(@Body() dto: RefreshTokenDto): Promise<ServiceResponse<MobileSessionResponse>> {
		return this.session(await this.authService.refreshSession(dto.refreshToken), 'Session refreshed');
	}

	/** Unauthenticated on purpose: signing out must work even with a dead access token. */
	@Post('logout')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Revoke the whole token family' })
	async logout(@Body() dto: RefreshTokenDto): Promise<ServiceResponse<null>> {
		await this.authService.logout(dto.refreshToken);
		return { message: 'Signed out', data: null };
	}

	// ---- authenticated ---------------------------------------------------------------------

	/**
	 * Changing the password signs out every OTHER device and hands THIS one a fresh pair, so
	 * the app that made the request keeps working — it just has to store what comes back.
	 * A name-only update revokes nothing and returns `tokens: null`.
	 */
	@Patch('me')
	@UseGuards(JwtGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: 'Update own name and/or password' })
	@ApiResponse({ status: 200, type: MobileProfileResponseDto })
	@ApiResponse({ status: 400, description: 'invalid_current_password' })
	async updateMe(@GetUser('id') userId: string, @Body() dto: UpdateProfileDto): Promise<ServiceResponse<MobileProfileResponse>> {
		const { user, session } = await this.authService.updateOwnProfile(userId, dto);
		return {
			message: 'Profile updated',
			data: { user, tokens: session ? { accessToken: session.accessToken, refreshToken: session.refreshToken } : null },
		};
	}

	/** The one place tokens are put into a body, so no handler can shape them differently. */
	private session(session: IssuedSession, message: string): ServiceResponse<MobileSessionResponse> {
		return {
			message,
			data: { user: session.user, tokens: { accessToken: session.accessToken, refreshToken: session.refreshToken } },
		};
	}
}
