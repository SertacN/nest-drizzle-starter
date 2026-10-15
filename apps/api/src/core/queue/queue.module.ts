import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DefaultJobOptions } from 'bullmq';

/**
 * Applied to every job unless the `add()` call overrides it. Retries are on by default: a job
 * usually talks to something that can fail transiently (mail, a third-party API), and a job
 * that must not be retried is the exception that says so.
 */
const DEFAULT_JOB_OPTIONS: DefaultJobOptions = {
	attempts: 3,
	backoff: { type: 'exponential', delay: 5_000 },
	// Finished jobs are kept for inspection but capped — without a limit they pile up in Redis
	// forever. Failed ones are kept longer because they are the ones someone needs to look at.
	removeOnComplete: { count: 1_000 },
	removeOnFail: { count: 5_000 },
};

/**
 * The shared BullMQ connection, configured once. This module owns NO queue: each feature
 * registers its own with `BullModule.registerQueue({ name })` in its module file, injects it
 * with `@InjectQueue(name)` and processes it with a `@Processor(name)` class next to it —
 * a queue belongs to the module whose work it carries, exactly like a table does.
 *
 * `forRoot` is global by itself, so nothing needs to import this module except AppModule.
 * Queues and workers are closed by @nestjs/bullmq on shutdown (app.enableShutdownHooks()).
 */
@Module({
	imports: [
		BullModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService) => ({
				connection: { url: config.getOrThrow<string>('REDIS_URL') },
				defaultJobOptions: DEFAULT_JOB_OPTIONS,
			}),
		}),
	],
})
export class QueueModule {}
