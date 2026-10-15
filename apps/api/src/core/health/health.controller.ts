import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import type { ServiceResponse } from '../http/types';
import { REDIS } from '../redis/redis.module';

@ApiTags('Health')
@Controller('health')
export class HealthController {
	constructor(
		@Inject(DRIZZLE) private readonly db: Database,
		@Inject(REDIS) private readonly redis: Redis,
	) {}

	/**
	 * Deliberately hits the database and Redis: a container that answers 200 while its pool is
	 * dead is worse than one that fails, because the orchestrator keeps routing traffic to it.
	 * Redis counts too — without it no job can be enqueued.
	 */
	@Get()
	@ApiOperation({ summary: 'Liveness + database and Redis connectivity' })
	async check(): Promise<ServiceResponse<{ status: string; db: string; redis: string }>> {
		await Promise.all([this.db.execute(sql`select 1`), this.redis.ping()]);
		return { message: 'ok', data: { status: 'ok', db: 'ok', redis: 'ok' } };
	}
}
