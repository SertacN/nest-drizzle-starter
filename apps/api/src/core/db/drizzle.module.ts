import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase, drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

/** Injection token for the Drizzle instance: `@Inject(DRIZZLE) private db: Database`. */
export const DRIZZLE = Symbol('DRIZZLE');
const PG_POOL = Symbol('PG_POOL');

/** The type every service annotates its injected client with. */
export type Database = NodePgDatabase<typeof schema>;

/**
 * Drizzle has no Nest integration of its own, so the pool and the client are plain providers.
 * Global because every module needs the DB and re-importing this everywhere is noise —
 * the boundary that matters is "only services touch it", not "only some modules can import it".
 */
@Global()
@Module({
	providers: [
		{
			provide: PG_POOL,
			inject: [ConfigService],
			useFactory: (config: ConfigService) =>
				new Pool({ connectionString: config.getOrThrow<string>('DATABASE_URL') }),
		},
		{
			provide: DRIZZLE,
			inject: [PG_POOL],
			// Passing the schema enables the relational query API (`db.query.users.findFirst`)
			// on top of the plain select/insert builders.
			useFactory: (pool: Pool) => drizzle(pool, { schema }),
		},
	],
	exports: [DRIZZLE],
})
export class DrizzleModule implements OnApplicationShutdown {
	constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

	// Without this the pool keeps the process alive and `docker stop` waits for the timeout.
	// Requires app.enableShutdownHooks() in main.ts.
	async onApplicationShutdown(): Promise<void> {
		await this.pool.end();
	}
}
