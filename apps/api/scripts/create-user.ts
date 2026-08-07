/**
 * Creates a user from the command line — the way to get the first admin into a fresh database.
 * Runs outside Nest, like the migrator.
 *
 *   pnpm --filter api user:create <email> <password> <name> [role]
 */
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { USER_ROLES, type UserRole } from 'shared';
import { users } from '../src/core/db/schema';
import { hashPassword } from '../src/core/utils/password.util';

config({ path: resolve(__dirname, '../../../.env'), quiet: true });

const [email, password, name, role = 'admin'] = process.argv.slice(2);

if (!email || !password || !name) {
	console.error('usage: pnpm --filter api user:create <email> <password> <name> [role]');
	process.exit(1);
}
if (!USER_ROLES.includes(role as UserRole)) {
	console.error(`role must be one of: ${USER_ROLES.join(', ')}`);
	process.exit(1);
}

async function main() {
	const pool = new Pool({ connectionString: process.env.DATABASE_URL });
	const db = drizzle(pool);
	try {
		const normalizedEmail = email.toLowerCase();
		const [existing] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
		if (existing) {
			console.error(`user already exists: ${normalizedEmail}`);
			process.exit(1);
		}

		const [created] = await db
			.insert(users)
			.values({
				email: normalizedEmail,
				name,
				role: role as UserRole,
				passwordHash: await hashPassword(password),
			})
			.returning();

		console.log(`created ${created.email} (${created.role}) id=${created.id}`);
	} finally {
		await pool.end();
	}
}

void main().catch((err: unknown) => {
	console.error('could not create user:', err);
	process.exit(1);
});
