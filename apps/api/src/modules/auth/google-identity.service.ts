import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface GoogleProfile {
	sub: string;
	email: string;
	name: string;
	picture: string | null;
}

interface TokenInfo {
	aud?: string;
	sub?: string;
	email?: string;
	email_verified?: string | boolean;
	name?: string;
	picture?: string;
	exp?: string;
}

/**
 * Verifies a Google ID token with Google's `tokeninfo` endpoint.
 *
 * One HTTPS call per sign-in instead of a JWKS client and a dependency: sign-in is rare, and
 * Google checks the signature and expiry for us. What Google cannot check for us is the
 * audience — a token minted for somebody else's app is equally valid to Google — so `aud`
 * must match our client id, and an unverified email is refused because we link accounts by
 * email.
 */
@Injectable()
export class GoogleIdentity {
	constructor(private readonly configService: ConfigService) {}

	async verify(idToken: string): Promise<GoogleProfile> {
		const clientId = this.configService.get<string>("security.googleClientId") ?? "";
		if (!clientId) {
			throw new UnauthorizedException("Google sign-in is not configured");
		}

		const response = await fetch(
			`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
		).catch(() => null);

		if (!response?.ok) {
			throw new UnauthorizedException("Invalid Google token");
		}

		const info = (await response.json()) as TokenInfo;
		const verified = info.email_verified === true || info.email_verified === "true";

		if (info.aud !== clientId || !info.sub || !info.email || !verified) {
			throw new UnauthorizedException("Invalid Google token");
		}

		return {
			sub: info.sub,
			email: info.email.toLowerCase(),
			name: info.name ?? info.email.split("@")[0],
			picture: info.picture ?? null,
		};
	}
}
