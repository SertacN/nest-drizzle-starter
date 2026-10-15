import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

/** Injection token for the shared Redis client: `@Inject(REDIS) private redis: Redis`. */
export const REDIS = Symbol('REDIS');

/**
 * One general-purpose connection for whatever a feature needs directly — a cache entry, a lock,
 * a counter. BullMQ does NOT use this client: queues and workers open their own connections
 * from the same REDIS_URL (see QueueModule), because a worker blocks its connection while it
 * waits for jobs and must not share it with anything else.
 *
 * Global for the same reason as DrizzleModule: it is infrastructure, not a feature.
 */
@Global()
@Module({
	providers: [
		{
			provide: REDIS,
			inject: [ConfigService],
			useFactory: (config: ConfigService) => new Redis(config.getOrThrow<string>('REDIS_URL')),
		},
	],
	exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
	constructor(@Inject(REDIS) private readonly redis: Redis) {}

	// Same as the pg pool: an open socket keeps the process alive past SIGTERM.
	async onApplicationShutdown(): Promise<void> {
		await this.redis.quit();
	}
}
