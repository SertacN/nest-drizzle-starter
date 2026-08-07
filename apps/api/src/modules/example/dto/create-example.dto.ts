import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { trim } from '../../../core/http/transforms';
import { IsEnum, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
import { EXAMPLE_STATUSES, type ExampleStatus } from 'shared';

export class CreateExampleDto {
	@ApiProperty({ maxLength: 200 })
	@IsString()
	@MinLength(1)
	@MaxLength(200)
	@Transform(trim)
	title: string;

	@ApiPropertyOptional({ maxLength: 5000 })
	@IsOptional()
	@IsString()
	@MaxLength(5000)
	@Transform(trim)
	body?: string;

	@ApiPropertyOptional({ enum: EXAMPLE_STATUSES, default: 'draft' })
	@IsOptional()
	@IsEnum(EXAMPLE_STATUSES)
	status?: ExampleStatus = 'draft';

	@ApiPropertyOptional({ description: 'URL returned by POST /uploads/image' })
	@IsOptional()
	@IsUrl({ require_host: false, require_tld: false })
	imageUrl?: string;
}
