import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { PublicExample } from 'shared';
import type { ServiceResponse } from '../../core/http/types';
import { ExampleService } from './example.service';

/**
 * The same module's ANONYMOUS surface, split off by file. One service and one table underneath
 * — what differs is the audience, and that difference must be visible at a glance.
 *
 * Every public endpoint carries its own throttle and returns a trimmed payload.
 */
@ApiTags('Examples (public)')
@Controller('public/examples')
export class PublicExampleController {
	constructor(private readonly exampleService: ExampleService) {}

	@Get()
	@Throttle({ default: { limit: 60, ttl: 60_000 } })
	@ApiOperation({ summary: 'Published examples — no session required' })
	async listPublished(): Promise<ServiceResponse<PublicExample[]>> {
		const rows = await this.exampleService.listPublished();
		return {
			message: 'Examples loaded',
			data: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
		};
	}
}
