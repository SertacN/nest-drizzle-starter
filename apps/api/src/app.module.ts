import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { WinstonModule } from 'nest-winston';
import type { ServerResponse } from 'node:http';
import { join } from 'node:path';
import { envValidationSchema } from './core/config/env.validation';
import { createWinstonConfig } from './core/config/winston.config';
import { DrizzleModule } from './core/db/drizzle.module';
import { HealthModule } from './core/health/health.module';
import { HttpLoggerMiddleware } from './core/http/middleware/http-logger.middleware';
import { RealtimeModule } from './core/realtime/realtime.module';
import { SecurityModule } from './core/security/security.module';
import { StorageModule } from './core/storage/storage.module';
import { UPLOADS_URL_PREFIX } from './core/storage/storage.service';
import { AuthModule } from './modules/auth';
import { ExampleModule } from './modules/example';
import { UploadModule } from './modules/uploads';

/**
 * The whole application in one file — this is the NestJS counterpart of a router: every module
 * that exists is listed here, grouped by what it is.
 *
 * Adding a feature = one import plus one line in `imports`.
 */
@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			validationSchema: envValidationSchema,
			// A single .env at the repo ROOT feeds every app. The second path is the fallback
			// for a container whose working directory is already the app folder.
			envFilePath: [join(process.cwd(), '../../.env'), join(process.cwd(), '.env')],
		}),

		// ---- infrastructure (core) ---------------------------------------------------------
		// All @Global(): every feature needs them and re-importing them everywhere is noise.
		DrizzleModule,
		SecurityModule,
		StorageModule,
		RealtimeModule,
		HealthModule,

		WinstonModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService) =>
				createWinstonConfig(config.get<string>('NODE_ENV', 'development')),
		}),

		// Applies to every route; individual handlers tighten it with @Throttle.
		ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 120 }] }),

		// Uploaded files. Mounted OUTSIDE the /api/v1 prefix (see main.ts) because the URLs are
		// stored in the database and must not move when the API version does.
		ServeStaticModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService) => [
				{
					rootPath: config.getOrThrow<string>('UPLOAD_DIR'),
					serveRoot: UPLOADS_URL_PREFIX,
					serveStaticOptions: {
						index: false,
						dotfiles: 'deny',
						// The filename changes on every upload (content is never updated in
						// place), which is what makes immutable caching safe.
						maxAge: '1y',
						immutable: true,
						setHeaders: (res: ServerResponse) => {
							res.setHeader('X-Content-Type-Options', 'nosniff');
							// helmet defaults to same-origin; images may be embedded elsewhere.
							res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
						},
					},
				},
			],
		}),

		// ---- features (modules) ------------------------------------------------------------
		AuthModule,
		ExampleModule,
		UploadModule,
	],
	providers: [
		// Rate limiting is opt-OUT, not opt-in: a new endpoint is protected the moment it exists.
		{ provide: APP_GUARD, useClass: ThrottlerGuard },
	],
})
export class AppModule implements NestModule {
	configure(consumer: MiddlewareConsumer): void {
		// `{*path}` — the path-to-regexp v8 wildcard, not the legacy `*`.
		consumer.apply(HttpLoggerMiddleware).forRoutes('{*path}');
	}
}
