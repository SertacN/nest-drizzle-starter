import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EXAMPLE_STATUSES, type ExampleStatus } from 'shared';

/** Swagger documentation only — the service returns the Drizzle row, whose shape matches. */
export class ExampleResponseDto {
	@ApiProperty({ format: 'uuid' })
	id: string;

	@ApiProperty({ format: 'uuid' })
	userId: string;

	@ApiProperty()
	title: string;

	@ApiPropertyOptional({ nullable: true })
	body: string | null;

	@ApiProperty({ enum: EXAMPLE_STATUSES })
	status: ExampleStatus;

	@ApiPropertyOptional({ nullable: true })
	imageUrl: string | null;

	@ApiProperty({ type: String, format: 'date-time' })
	createdAt: Date;

	@ApiProperty({ type: String, format: 'date-time' })
	updatedAt: Date;
}
