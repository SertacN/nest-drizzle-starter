import { utilities as nestWinstonUtilities, WinstonModuleOptions } from 'nest-winston';
import { resolve } from 'node:path';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

// Anchored to the app folder, not to the working directory: `pnpm dev`, `node dist/main.js`
// from the repo root and the container all have a different cwd, and logs that move around
// depending on how you started the process are logs you cannot find.
// src/core/config or dist/core/config -> apps/api: the same depth either way.
const LOG_DIR = resolve(__dirname, '../../../logs');

const { combine, timestamp, errors, json } = winston.format;

// Structured JSON on disk: a human reads the console, a log collector reads the files.
const fileFormat = combine(timestamp(), errors({ stack: true }), json());

function dailyRotate(fileName: string, level: string): winston.transport {
	return new winston.transports.DailyRotateFile({
		filename: resolve(LOG_DIR, fileName),
		datePattern: 'YYYY-MM-DD',
		maxFiles: '15d',
		maxSize: '20m',
		zippedArchive: true,
		level,
		format: fileFormat,
	});
}

/**
 * Two rotating files (all info+ and errors only) plus a pretty console in development.
 * In production the console transport is dropped: `docker logs` already captures stdout,
 * and colour codes make that output unreadable.
 */
export function createWinstonConfig(nodeEnv: string): WinstonModuleOptions {
	const isDev = nodeEnv !== 'production';

	const transports: winston.transport[] = [
		dailyRotate('app-%DATE%.log', 'info'),
		dailyRotate('error-%DATE%.log', 'error'),
	];

	if (isDev) {
		transports.push(
			new winston.transports.Console({
				format: combine(
					timestamp(),
					winston.format.ms(),
					nestWinstonUtilities.format.nestLike('API', { prettyPrint: true, colors: true }),
				),
			}),
		);
	} else {
		transports.push(new winston.transports.Console({ format: fileFormat }));
	}

	return { transports, level: isDev ? 'debug' : 'info' };
}
