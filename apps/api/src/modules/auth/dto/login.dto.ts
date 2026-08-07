import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { trimLowercase } from '../../../core/http/transforms';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
	@ApiProperty({ example: 'admin@example.com' })
	@IsEmail()
	@MaxLength(255)
	@Transform(trimLowercase)
	email: string;

	// No MinLength here on purpose: the rule may have changed since this account was created,
	// and rejecting a valid old password with a validation error would be a lockout.
	@ApiProperty({ example: 'secret123' })
	@IsString()
	@MinLength(1)
	@MaxLength(200)
	password: string;
}
