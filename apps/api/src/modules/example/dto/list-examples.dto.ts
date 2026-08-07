import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { EXAMPLE_STATUSES, type ExampleStatus } from 'shared';
import { PaginationDto } from '../../../core/http/dto';

export class ListExamplesDto extends PaginationDto {
	@ApiPropertyOptional({ enum: EXAMPLE_STATUSES })
	@IsOptional()
	@IsEnum(EXAMPLE_STATUSES)
	status?: ExampleStatus;
}
