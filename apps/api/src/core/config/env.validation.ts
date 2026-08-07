import * as Joi from 'joi';
import { resolve } from 'node:path';

/**
 * Every environment variable the API reads, in one schema. ConfigModule validates it at boot,
 * so a misconfigured deploy fails loudly on startup instead of at the first request that needs
 * the missing value.
 */
export const envValidationSchema = Joi.object({
	NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
	PORT: Joi.number().default(3000),

	DATABASE_URL: Joi.string().required(),

	// The two secrets must differ: a refresh token must not be accepted where an access token
	// is expected, and separate secrets make that structurally impossible.
	JWT_ACCESS_SECRET: Joi.string().min(16).required().disallow(Joi.ref('JWT_REFRESH_SECRET')).messages({
		'any.invalid': 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ',
	}),
	JWT_REFRESH_SECRET: Joi.string().min(16).required(),
	JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
	JWT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),

	/** Comma-separated allowed browser origins. Empty = same-origin only (dev proxy / Traefik). */
	CORS_ORIGIN: Joi.string().allow('').default(''),

	/** Root of uploaded files. In production this points at a persistent volume. */
	UPLOAD_DIR: Joi.string().default(resolve(process.cwd(), '../../uploads')),

	// Read by docker compose, not by the app — declared so an unknown-key check would not trip
	// over them and so `.env.example` and this file stay a matched pair.
	DOMAIN: Joi.string().optional(),
	DB_NAME: Joi.string().optional(),
	DB_USER: Joi.string().optional(),
	DB_PASSWORD: Joi.string().optional(),
});

/** Parsed once here so callers never re-split the string on every request. */
export function parseCorsOrigins(value: string | undefined): string[] {
	return (value ?? '')
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean);
}
