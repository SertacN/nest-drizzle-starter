import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TokenService } from './token.service';

/**
 * `JwtModule.register({})` on purpose: no secret is configured here because every call passes
 * its own (access vs refresh). A default secret would be the one that silently gets used when
 * a call forgets to pass one.
 */
@Global()
@Module({
	imports: [JwtModule.register({})],
	providers: [TokenService],
	exports: [TokenService],
})
export class SecurityModule {}
