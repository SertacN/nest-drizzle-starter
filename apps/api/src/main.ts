import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from './app.module';
import { parseCorsOrigins } from './core/config/env.validation';
import { AllExceptionsFilter } from './core/http/filters';
import { ResponseTransformInterceptor } from './core/http/interceptors';

async function bootstrap(): Promise<void> {
	const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
	const config = app.get(ConfigService);
	const isProduction = config.get<string>('NODE_ENV') === 'production';

	app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

	// Runs behind exactly one proxy hop (production: Traefik, dev: the frontend's proxy) —
	// required for the throttler to read the real client IP from X-Forwarded-For.
	app.set('trust proxy', 1);

	app.use(helmet());
	// Cookies are the token transport, so the auth decorators need them parsed first.
	app.use(cookieParser());

	const origins = parseCorsOrigins(config.get<string>('CORS_ORIGIN'));
	app.enableCors({
		// credentials + a wildcard origin is rejected by every browser, so an empty list means
		// same-origin only (the dev proxy, or Traefik in production) rather than "allow all".
		origin: origins.length > 0 ? origins : false,
		credentials: true,
	});

	app.useGlobalPipes(
		new ValidationPipe({
			// Strips properties no DTO declared: a client cannot smuggle `role: "admin"` into a
			// body and have it reach a service.
			whitelist: true,
			transform: true,
			transformOptions: { enableImplicitConversion: true },
		}),
	);
	app.useGlobalFilters(new AllExceptionsFilter(app.get(WINSTON_MODULE_NEST_PROVIDER)));
	app.useGlobalInterceptors(new ResponseTransformInterceptor());

	// Raw `ws`, not socket.io: no client library needed and the path stays a plain /ws.
	app.useWebSocketAdapter(new WsAdapter(app));

	// Static uploads are excluded so their stored URLs never carry a version.
	// `{*path}` is the path-to-regexp v8 wildcard Express 5 uses — the old `(.*)` still works
	// via a deprecation shim, but only for now.
	app.setGlobalPrefix('api/v1', { exclude: ['api/uploads/{*path}'] });

	// Lets DrizzleModule close the pool on SIGTERM instead of the container timing out.
	app.enableShutdownHooks();

	// Nowhere near production: the schema is a map of every endpoint and every field name.
	if (!isProduction) {
		const document = SwaggerModule.createDocument(
			app,
			new DocumentBuilder()
				.setTitle('API')
				.setDescription('NestJS + Drizzle starter API')
				.setVersion('1.0')
				.addCookieAuth('access_token')
				// So the "Authorize" button works from a terminal-issued token too.
				.addBearerAuth()
				.build(),
		);
		SwaggerModule.setup('api/docs', app, document, {
			// Without this the browser drops the auth cookies on every "Try it out".
			swaggerOptions: { withCredentials: true },
		});
	}

	await app.listen(config.get<number>('PORT', 3000));
}

void bootstrap();
