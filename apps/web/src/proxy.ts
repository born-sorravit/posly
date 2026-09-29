import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/cookie-names";
import { env } from "@/lib/env";
import { routing } from "@/i18n/routing";
import createMiddleware from "next-intl/middleware";
import type { NextRequest, NextResponse } from "next/server";

const handleIntl = createMiddleware(routing);

/** Reads `exp` without verifying — the API is the only thing that may trust this token. */
const isExpired = (jwt: string): boolean => {
	try {
		const [, payload] = jwt.split(".");
		const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { exp?: number };
		// Treat "about to expire" as expired so a request does not die mid-flight.
		return typeof exp !== "number" || exp * 1000 <= Date.now() + 10_000;
	} catch {
		return true;
	}
};

/**
 * Locale routing, plus session refresh.
 *
 * Refresh lives here because middleware is the only thing that runs *before* a page renders
 * and can still write cookies. Doing it in a server component is impossible — rotation
 * revokes the presented token and the replacement could never be persisted — and doing it on
 * mount in the client meant a signed-out header for one frame on every stale load.
 *
 * Concurrent requests can still each land here; the API forgives a just-rotated token for a
 * few seconds precisely so that is harmless.
 */
export default async function proxy(request: NextRequest) {
	const response = handleIntl(request) as NextResponse;

	const access = request.cookies.get(ACCESS_COOKIE)?.value;
	const refresh = request.cookies.get(REFRESH_COOKIE)?.value;

	if (!refresh || (access && !isExpired(access))) {
		return response;
	}

	try {
		const refreshed = await fetch(`${env.apiBaseUrl}/auth/refresh`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ refreshToken: refresh }),
			cache: "no-store",
		});

		if (!refreshed.ok) {
			// The refresh token is single-use, so a rejected one is dead for good — clearing
			// the cookies stops every later request retrying a token that can never work.
			response.cookies.delete(ACCESS_COOKIE);
			response.cookies.delete(REFRESH_COOKIE);
			return response;
		}

		const { data } = (await refreshed.json()) as {
			data: { accessToken: string; refreshToken: string };
		};

		const options = {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax" as const,
			path: "/",
			maxAge: 60 * 60 * 24 * 30,
		};
		response.cookies.set(ACCESS_COOKIE, data.accessToken, options);
		response.cookies.set(REFRESH_COOKIE, data.refreshToken, options);

		// The page renders in this same pass, so it must see the new token rather than the
		// expired one it arrived with.
		request.cookies.set(ACCESS_COOKIE, data.accessToken);
		request.cookies.set(REFRESH_COOKIE, data.refreshToken);
	} catch {
		// A refresh failure must never block navigation; the page renders signed out.
	}

	return response;
}

export const config = {
	// Everything except Next internals, our own route handlers, and anything file-shaped.
	matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
