import { env } from "@/lib/env";
import {
	type BackendSession,
	callAuth,
	clearSessionCookies,
	readTokens,
	setSessionCookies,
} from "@/lib/auth/session";
import { NextResponse } from "next/server";

/**
 * Authenticated calls are proxied through here so the browser never handles a token.
 *
 * Only calls that need a session use it — public job browsing still goes straight to the
 * API, so the extra hop is not on the path that matters for page load.
 */

/**
 * In-flight refresh, shared by every request in this server instance.
 *
 * Refresh tokens are single-use: two requests that both 401 and both rotate would each
 * revoke the other's token and sign the user out. Sharing one promise means the second
 * caller waits for the first's result instead of starting a competing rotation.
 */
let refreshInFlight: Promise<BackendSession | null> | null = null;

async function refreshOnce(): Promise<BackendSession | null> {
	if (refreshInFlight) return refreshInFlight;

	refreshInFlight = (async () => {
		const { refreshToken } = await readTokens();
		if (!refreshToken) return null;

		const result = await callAuth<BackendSession>("refresh", { refreshToken });
		if (!result.ok) {
			await clearSessionCookies();
			return null;
		}

		await setSessionCookies(result.data);
		return result.data;
	})().finally(() => {
		refreshInFlight = null;
	});

	return refreshInFlight;
}

const HOP_BY_HOP = new Set(["connection", "keep-alive", "transfer-encoding", "upgrade", "host"]);

async function forward(request: Request, path: string[], accessToken?: string) {
	const url = new URL(request.url);
	const target = `${env.apiBaseUrl}/${path.join("/")}${url.search}`;

	const headers = new Headers();
	for (const [key, value] of request.headers) {
		const name = key.toLowerCase();
		// Never forward the browser's cookies upstream: the API has no use for them, and
		// passing our session cookies to another origin is exactly what this proxy exists to
		// avoid.
		if (name === "cookie" || HOP_BY_HOP.has(name)) continue;
		headers.set(key, value);
	}
	if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

	const body =
		request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();

	return fetch(target, { method: request.method, headers, body, cache: "no-store" });
}

async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
	const { path } = await context.params;
	const { accessToken } = await readTokens();

	let upstream = await forward(request.clone(), path, accessToken);

	// A 401 means the access token expired, not that the session ended — rotate once and
	// retry. Only once: a second 401 after a fresh token is a real authorisation failure.
	if (upstream.status === 401) {
		const session = await refreshOnce();
		if (session) {
			upstream = await forward(request, path, session.accessToken);
		}
	}

	const responseHeaders = new Headers();
	const contentType = upstream.headers.get("content-type");
	if (contentType) responseHeaders.set("content-type", contentType);
	// `set-cookie` from upstream is deliberately dropped. The API does not set cookies, and
	// letting any through would let another origin write into our session cookie namespace.

	return new NextResponse(upstream.body, {
		status: upstream.status,
		headers: responseHeaders,
	});
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
