import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';
import { resolve } from 'node:path';

// One .env at the repo root feeds every app — drizzle-kit runs outside Nest, so it loads it
// itself instead of going through ConfigModule.
config({ path: resolve(__dirname, '../../.env'), quiet: true });

export default defineConfig({
	dialect: 'postgresql',
	// The barrel, not the folder: a table missing from schema/index.ts does not exist as far as
	// `db:generate` is concerned.
	schema: './src/core/db/schema/index.ts',
	out: './src/core/db/migrations',
	dbCredentials: { url: process.env.DATABASE_URL! },
});
