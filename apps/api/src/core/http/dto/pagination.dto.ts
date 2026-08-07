import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Extend this in a list endpoint's query DTO instead of redeclaring page/perPage. */
export class PaginationDto {
	@ApiPropertyOptional({ description: 'Page number, 1-based', default: 1, minimum: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page: number = 1;

	// Capped: without a maximum, `?perPage=1000000` is a free denial of service.
	@ApiPropertyOptional({ description: 'Rows per page', default: 20, minimum: 1, maximum: 100 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	perPage: number = 20;

	get offset(): number {
		return (this.page - 1) * this.perPage;
	}
}
