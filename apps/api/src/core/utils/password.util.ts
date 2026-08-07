import * as bcrypt from 'bcryptjs';

// 12 rounds: roughly 250ms on current server hardware. Lower is cheap to brute-force,
// higher turns the login endpoint into its own denial of service.
const SALT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
	return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
	return bcrypt.compare(plain, hash);
}
