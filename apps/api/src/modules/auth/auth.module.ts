import { AuthController } from "@/modules/auth/auth.controller";
import { AuthService } from "@/modules/auth/auth.service";
import { GoogleIdentity } from "@/modules/auth/google-identity.service";
import { SessionCleanupService } from "@/modules/auth/session-cleanup.service";
import { JwtStrategy } from "@/modules/auth/strategies/jwt.strategy";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";

@Module({
	imports: [
		PassportModule,
		JwtModule.registerAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService) => ({
				secret: config.getOrThrow<string>("security.jwt.secret"),
				// `expiresIn` is typed as ms's literal-union StringValue; the value is validated
				// at the config boundary, so the cast is the narrowing that type cannot express.
				signOptions: {
					expiresIn: config.get<string>(
						"security.jwt.expiresIn",
						"15m"
					) as `${number}m`,
				},
			}),
		}),
	],
	controllers: [AuthController],
	providers: [AuthService, GoogleIdentity, JwtStrategy, SessionCleanupService],
	exports: [AuthService],
})
export class AuthModule {}
