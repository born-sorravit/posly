import { type BackendSession, callAuth, readTokens, setSessionCookies } from "@/lib/auth/session";
import { NextResponse } from "next/server";

/**
 * Hands this till to another member by their PIN. The new session replaces this browser's
 * cookies, and the one it replaces is revoked — the previous person is signed out of this
 * device, not left with a live refresh token nobody holds.
 */
export async function POST(request: Request) {
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== "object") {
		return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
	}

	const { accessToken, refreshToken } = await readTokens();
	if (!accessToken) {
		return NextResponse.json({ message: "Not signed in" }, { status: 401 });
	}

	const result = await callAuth<BackendSession>("pin-login", body, { accessToken });
	if (!result.ok) {
		return NextResponse.json({ message: result.message, details: result.details }, { status: result.status });
	}

	if (refreshToken) await callAuth("logout", { refreshToken }).catch(() => undefined);
	await setSessionCookies(result.data);
	return NextResponse.json({ user: result.data.user });
}
