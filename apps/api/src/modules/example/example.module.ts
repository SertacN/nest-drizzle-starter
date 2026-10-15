import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { ExampleController } from './example.controller';
import { ExampleProcessor } from './example.processor';
import { EXAMPLE_QUEUE } from './example.queue';
import { ExampleService } from './example.service';
import { PublicExampleController } from './public-example.controller';

@Module({
	imports: [
		// For JwtGuard: the 'jwt' passport strategy is registered by AuthModule.
		AuthModule,
		// The module owns its queue; the connection comes from QueueModule's forRoot.
		BullModule.registerQueue({ name: EXAMPLE_QUEUE }),
	],
	controllers: [ExampleController, PublicExampleController],
	providers: [ExampleService, ExampleProcessor],
})
export class ExampleModule {}
