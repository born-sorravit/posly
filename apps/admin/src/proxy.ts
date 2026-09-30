import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/cookie-names";
import { env } from "@/lib/env";
import { type NextRequest, NextResponse } from "next/server";

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

const cookieOptions = {
	httpOnly: true,
	secure: process.env.NODE_ENV === "production",
	sameSite: "lax" as const,
	path: "/",
	maxAge: 60 * 60 * 24 * 30,
};

/**
 * Sends signed-out visitors to /login, and refreshes a stale session before the page renders
 * — the only point that both runs first and can still write cookies (same reasoning as the
 * web app's proxy). Whether the person is actually an admin is decided by the dashboard
 * layout, which asks the API.
 */
export default async function proxy(request: NextRequest) {
	const onLogin = request.nextUrl.pathname === "/login";
	const access = request.cookies.get(ACCESS_COOKIE)?.value;
	const refresh = request.cookies.get(REFRESH_COOKIE)?.value;

	if (!refresh && !access) {
		return onLogin ? NextResponse.next() : NextResponse.redirect(new URL("/login", request.url));
	}

	const response = NextResponse.next({ request });
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
			// Single-use token, so a rejected one is dead for good.
			const out = onLogin ? NextResponse.next() : NextResponse.redirect(new URL("/login", request.url));
			out.cookies.delete(ACCESS_COOKIE);
			out.cookies.delete(REFRESH_COOKIE);
			return out;
		}

		const { data } = (await refreshed.json()) as {
			data: { accessToken: string; refreshToken: string };
		};

		// The page renders in this same pass, so it must see the new token.
		request.cookies.set(ACCESS_COOKIE, data.accessToken);
		request.cookies.set(REFRESH_COOKIE, data.refreshToken);
		const out = NextResponse.next({ request });
		out.cookies.set(ACCESS_COOKIE, data.accessToken, cookieOptions);
		out.cookies.set(REFRESH_COOKIE, data.refreshToken, cookieOptions);
		return out;
	} catch {
		// A refresh failure must never block navigation; the layout decides what to show.
		return response;
	}
}

export const config = {
	matcher: ["/((?!api|_next|.*\\..*).*)"],
};
