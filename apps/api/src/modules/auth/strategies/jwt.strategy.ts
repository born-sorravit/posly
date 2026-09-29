import { AuthenticatedUser } from "@/shared/decorators/current-user.decorator";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

/** Identity only — roles are per business and never ride in the token. */
export interface AccessTokenPayload {
	sub: string;
	email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
	constructor(configService: ConfigService) {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
			secretOrKey: configService.getOrThrow<string>("security.jwt.secret"),
		});
	}

	validate(payload: AccessTokenPayload): AuthenticatedUser {
		return { id: payload.sub, email: payload.email };
	}
}
