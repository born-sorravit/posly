import "server-only";

import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/cookie-names";
import { env } from "@/lib/env";
import type { AuthUser } from "@posly/types/api";
import { cookies } from "next/headers";

export { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/cookie-names";

export interface BackendSession {
	accessToken: string;
	refreshToken: string;
	expiresIn: number;
	user: AuthUser;
}

/**
 * Cookies are set on **our own** domain, not the API's.
 *
 * The frontend deploys to Vercel and the API to Render — different sites — so a cookie set
 * by the API would be third-party, which Safari's ITP already blocks and Chrome is phasing
 * out. Setting them here keeps them first-party, and `httpOnly` keeps the tokens out of
 * reach of any script on the page.
 */
export const cookieOptions = (maxAgeSeconds: number) =>
	({
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax" as const,
		path: "/",
		maxAge: maxAgeSeconds,
	});

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function setSessionCookies(session: BackendSession): Promise<void> {
	const store = await cookies();
	// Both cookies outlive the access token deliberately. The JWT's own `exp` is what makes
	// it invalid; keeping the cookie lets the server still present it, get a 401, and know
	// that a refresh is due — rather than the cookie vanishing and the session looking
	// signed out when it is merely stale.
	store.set(ACCESS_COOKIE, session.accessToken, cookieOptions(THIRTY_DAYS));
	store.set(REFRESH_COOKIE, session.refreshToken, cookieOptions(THIRTY_DAYS));
}

export async function clearSessionCookies(): Promise<void> {
	const store = await cookies();
	store.delete(ACCESS_COOKIE);
	store.delete(REFRESH_COOKIE);
}

export async function readTokens(): Promise<{ accessToken?: string; refreshToken?: string }> {
	const store = await cookies();
	return {
		accessToken: store.get(ACCESS_COOKIE)?.value,
		refreshToken: store.get(REFRESH_COOKIE)?.value,
	};
}

/** Calls the API's auth endpoints. Server-side only — the browser never sees these. */
export async function callAuth<T>(
	path: string,
	body: unknown,
	// Only for the endpoints that both need a session *and* hand back new tokens, which is
	// why they cannot go through the /api/backend proxy: it drops the response's cookies.
	options: { method?: string; accessToken?: string; userAgent?: string | null } = {}
): Promise<
	{ ok: true; data: T } | { ok: false; status: number; message: string; details?: Record<string, unknown> }
> {
	const response = await fetch(`${env.apiBaseUrl}/auth/${path}`, {
		method: options.method ?? "POST",
		headers: {
			"Content-Type": "application/json",
			...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
			// The browser's, not this server's: the API labels the session's device with it.
			...(options.userAgent ? { "User-Agent": options.userAgent } : {}),
		},
		body: JSON.stringify(body),
		cache: "no-store",
	});

	const payload = (await response.json().catch(() => null)) as
		| { data?: T; message?: string; details?: Record<string, unknown> }
		| null;

	if (!response.ok) {
		return {
			ok: false,
			status: response.status,
			message: payload?.message ?? "Request failed",
			details: payload?.details,
		};
	}

	return { ok: true, data: payload?.data as T };
}

/**
 * The signed-in user for a server component, or null.
 *
 * Deliberately does **not** refresh. Refreshing rotates the token — the presented one is
 * revoked — and a server component cannot write the replacement back to a cookie, so doing
 * it here would revoke the user's session on every stale render. Refresh happens only where
 * cookies can be set: the route handlers under `/api/auth` and the `/api/backend` proxy.
 *
 * By the time a page renders, middleware has already refreshed a stale token, so this
 * reading the cookie is enough.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
	const { accessToken } = await readTokens();
	if (!accessToken) return null;

	const response = await fetch(`${env.apiBaseUrl}/auth/me`, {
		headers: { Authorization: `Bearer ${accessToken}` },
		cache: "no-store",
	});

	if (!response.ok) return null;

	const payload = (await response.json()) as { data: AuthUser };
	return payload.data;
}

