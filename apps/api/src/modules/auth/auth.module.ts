import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MobileAuthController } from './mobile-auth.controller';
import { JwtStrategy } from './strategy';

@Module({
	// `session: false` — the session IS the token pair; passport must not also open one.
	imports: [PassportModule.register({ session: false })],
	// One service, two HTTP surfaces: cookies for the browser, Bearer tokens for a device.
	controllers: [AuthController, MobileAuthController],
	providers: [AuthService, JwtStrategy],
	// Other modules guard their routes with JwtGuard, which needs this strategy registered.
	exports: [PassportModule],
})
export class AuthModule {}
