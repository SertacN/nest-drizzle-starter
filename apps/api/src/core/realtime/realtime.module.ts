import { Global, Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';

/**
 * Global so any module can inject EventsGateway to push an update, without the gateway
 * needing to know that module exists.
 */
@Global()
@Module({
	providers: [EventsGateway],
	exports: [EventsGateway],
})
export class RealtimeModule {}
