import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import type { ServiceResponse } from '../http/types';

@ApiTags('Health')
@Controller('health')
export class HealthController {
	constructor(@Inject(DRIZZLE) private readonly db: Database) {}

	/**
	 * Deliberately hits the database: a container that answers 200 while its pool is dead is
	 * worse than one that fails, because the orchestrator keeps routing traffic to it.
	 */
	@Get()
	@ApiOperation({ summary: 'Liveness + database connectivity' })
	async check(): Promise<ServiceResponse<{ status: string; db: string }>> {
		await this.db.execute(sql`select 1`);
		return { message: 'ok', data: { status: 'ok', db: 'ok' } };
	}
}
