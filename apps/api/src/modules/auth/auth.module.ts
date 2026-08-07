import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategy';

@Module({
	// `session: false` — the session IS the cookie pair; passport must not also open one.
	imports: [PassportModule.register({ session: false })],
	controllers: [AuthController],
	providers: [AuthService, JwtStrategy],
	// Other modules guard their routes with JwtGuard, which needs this strategy registered.
	exports: [PassportModule],
})
export class AuthModule {}
