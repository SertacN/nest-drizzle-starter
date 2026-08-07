import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { trim } from '../../../core/http/transforms';
import { IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from 'shared';

export class UpdateProfileDto {
	@ApiPropertyOptional({ example: 'Sertaç Can', minLength: 2, maxLength: 120 })
	@IsOptional()
	@IsString()
	@MinLength(2)
	@MaxLength(120)
	@Transform(trim)
	name?: string;

	// Required exactly when a new password is being set: proving you know the old one is what
	// stops a stolen session from locking the real owner out. The service checks it as well.
	@ApiPropertyOptional({ description: 'Required when newPassword is set' })
	@ValidateIf((dto: UpdateProfileDto) => dto.newPassword !== undefined)
	@IsString()
	@MinLength(1)
	@MaxLength(PASSWORD_MAX_LENGTH)
	currentPassword?: string;

	@ApiPropertyOptional({ minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH })
	@IsOptional()
	@IsString()
	@MinLength(PASSWORD_MIN_LENGTH)
	@MaxLength(PASSWORD_MAX_LENGTH)
	newPassword?: string;
}
