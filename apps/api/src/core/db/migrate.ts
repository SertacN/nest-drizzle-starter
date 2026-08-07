/**
 * Applies every pending migration, then exits. Runs OUTSIDE Nest (no DI container, no HTTP
 * server) so it can be the first thing a deploy does:
 *
 *   pnpm --filter api db:migrate                    # locally, via tsx
 *   docker compose exec api node dist/core/db/migrate.js
 */
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { resolve } from 'node:path';
import { Pool } from 'pg';

config({ path: resolve(__dirname, '../../../../../.env'), quiet: true });
// src/core/db or dist/core/db -> repo root: the same depth either way.

async function main() {
	const connectionString = process.env.DATABASE_URL;
	if (!connectionString) throw new Error('DATABASE_URL is not set');

	const pool = new Pool({ connectionString });
	try {
		await migrate(drizzle(pool), { migrationsFolder: resolve(__dirname, 'migrations') });
		console.log('migrations applied');
	} finally {
		await pool.end();
	}
}

void main().catch((err: unknown) => {
	console.error('migration failed:', err);
	process.exit(1);
});
