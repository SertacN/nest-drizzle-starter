import { ApiProperty } from '@nestjs/swagger';
import type { MobileTokens } from 'shared';
import { UserResponseDto } from './user-response.dto';

/**
 * The pair the app has to store. This is the ONE place tokens leave the API in a body — the
 * web surface keeps them in httpOnly cookies, but a device has no such thing.
 */
export class MobileTokensDto implements MobileTokens {
	@ApiProperty({ description: 'Send as `Authorization: Bearer …`. Short-lived; may live in memory.' })
	accessToken!: string;

	@ApiProperty({ description: 'Belongs in the Keychain / Keystore, never in plain storage.' })
	refreshToken!: string;
}

export class MobileSessionResponseDto {
	@ApiProperty({ type: UserResponseDto })
	user!: UserResponseDto;

	@ApiProperty({ type: MobileTokensDto })
	tokens!: MobileTokensDto;
}

export class MobileProfileResponseDto {
	@ApiProperty({ type: UserResponseDto })
	user!: UserResponseDto;

	@ApiProperty({
		type: MobileTokensDto,
		nullable: true,
		description: 'Only after a password change — the old pair is revoked, store this one instead.',
	})
	tokens!: MobileTokensDto | null;
}
