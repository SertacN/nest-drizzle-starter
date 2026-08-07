import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { trim, trimLowercase } from '../../../core/http/transforms';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from 'shared';

export class RegisterDto {
	@ApiProperty({ example: 'admin@example.com', maxLength: 255 })
	@IsEmail()
	@MaxLength(255)
	// Lower-cased here rather than in the service, so the uniqueness check and the stored value
	// can never disagree about what "the same address" means.
	@Transform(trimLowercase)
	email: string;

	@ApiProperty({ example: 'secret123', minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH })
	@IsString()
	@MinLength(PASSWORD_MIN_LENGTH)
	@MaxLength(PASSWORD_MAX_LENGTH)
	password: string;

	@ApiProperty({ example: 'Admin', minLength: 2, maxLength: 120 })
	@IsString()
	@MinLength(2)
	@MaxLength(120)
	@Transform(trim)
	name: string;
}
