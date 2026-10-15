import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, NotFoundException } from '@nestjs/common';
import type { Job } from 'bullmq';
import { EventsGateway } from '../../core/realtime/events.gateway';
import { EXAMPLE_QUEUE, ExampleJob, type ExamplePublishedJobData } from './example.queue';
import { ExampleService } from './example.service';

/**
 * The worker for this module's queue. It runs inside the API process; moving it to a separate
 * worker process later only means booting a second app that imports this module.
 *
 * A processor is NOT a second data layer: it reads and writes through the service, like a
 * controller does. And it must be idempotent — a job is retried after a failure (or a crash
 * mid-run), so running it twice must not do the work twice.
 */
@Processor(EXAMPLE_QUEUE)
export class ExampleProcessor extends WorkerHost {
	private readonly logger = new Logger(ExampleProcessor.name);

	constructor(
		private readonly examples: ExampleService,
		private readonly events: EventsGateway,
	) {
		super();
	}

	// One queue, several job names: dispatch on the name. An unknown one fails loudly instead
	// of being marked completed without anything having run.
	async process(job: Job): Promise<void> {
		switch (job.name) {
			case ExampleJob.Published:
				return this.handlePublished(job as Job<ExamplePublishedJobData>);
			default:
				throw new Error(`unknown_job: ${job.name}`);
		}
	}

	/**
	 * A stand-in for the real work (notify followers, render a preview, call a webhook…). It
	 * re-reads the row because the job carries ids only — and the row may have changed or
	 * disappeared since it was enqueued.
	 */
	private async handlePublished(job: Job<ExamplePublishedJobData>): Promise<void> {
		const { userId, exampleId } = job.data;
		try {
			const row = await this.examples.get(userId, exampleId);
			if (row.status !== 'published') return;
			this.events.sendToUser(userId, 'example.published', { id: row.id, title: row.title });
		} catch (error) {
			// Deleted in the meantime: nothing left to do, and retrying will not bring it back.
			if (error instanceof NotFoundException) return;
			throw error;
		}
	}

	// Each attempt that throws lands here; the job itself is retried per its attempts/backoff.
	@OnWorkerEvent('failed')
	onFailed(job: Job | undefined, error: Error): void {
		this.logger.error(`job ${job?.name}#${job?.id} failed (attempt ${job?.attemptsMade}): ${error.message}`, error.stack);
	}
}
