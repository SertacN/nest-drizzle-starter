import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';

/** Global for the same reason as DrizzleModule: it is infrastructure, not a feature. */
@Global()
@Module({
	providers: [StorageService],
	exports: [StorageService],
})
export class StorageModule {}
