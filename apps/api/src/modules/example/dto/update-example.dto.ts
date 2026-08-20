import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUrl, ValidateIf } from 'class-validator';
import { EXAMPLE_STATUSES, type ExampleStatus } from 'shared';
import { CreateExampleDto } from './create-example.dto';

/**
 * Every field optional — but `status` and `imageUrl` are dropped from the base and redeclared.
 *
 * PartialType() carries CreateExampleDto's `= 'draft'` default along, so a PATCH that only
 * touches the title would parse as `status: 'draft'` and silently unpublish the row. A
 * partial-update DTO must never inherit a default.
 */
export class UpdateExampleDto extends PartialType(OmitType(CreateExampleDto, ['status', 'imageUrl'] as const)) {
	@ApiPropertyOptional({ enum: EXAMPLE_STATUSES })
	@IsOptional()
	@IsEnum(EXAMPLE_STATUSES)
	status?: ExampleStatus;

	/** Explicit `null` detaches the current image — and the service deletes the file. */
	@ApiPropertyOptional({ nullable: true, description: 'null detaches the current image' })
	@IsOptional()
	// IsUrl rejects null outright, so it is skipped for exactly that value.
	@ValidateIf((_, value) => value !== null)
	@IsUrl({ require_host: false, require_tld: false })
	imageUrl?: string | null;
}
