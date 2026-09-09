import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsString, MaxLength } from 'class-validator';

/**
 * The mobile surface has no cookie jar, so the refresh token arrives in the body. `IsJWT`
 * rejects garbage before it ever reaches a signature check, and the length cap keeps a
 * megabyte of nonsense out of the verifier.
 */
export class RefreshTokenDto {
	@ApiProperty({ description: 'The refresh token handed out by the last mobile session call' })
	@IsString()
	@MaxLength(4096)
	@IsJWT()
	refreshToken!: string;
}
