import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { ExampleController } from './example.controller';
import { ExampleService } from './example.service';
import { PublicExampleController } from './public-example.controller';

@Module({
	// For JwtGuard: the 'jwt' passport strategy is registered by AuthModule.
	imports: [AuthModule],
	controllers: [ExampleController, PublicExampleController],
	providers: [ExampleService],
})
export class ExampleModule {}
