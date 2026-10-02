/**
 * Applies every pending migration, then exits. Runs OUTSIDE Nest (no DI container, no HTTP
 * server) so it can be the first thing a deploy does:
 *
 *   pnpm --filter api db:migrate                    # locally, via tsx
 *   docker compose exec api node dist/core/db/migrate.js
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';

// Node's built-in loader, not dotenv: this file ships in dist/ and dotenv is a devDependency,
// so the production image does not have it. In a container there is no .env file at all —
// compose injects the variables — hence the existence check.
// src/core/db or dist/core/db -> repo root: the same depth either way.
const envFile = resolve(__dirname, '../../../../../.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

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
