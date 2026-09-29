import { type BackendSession, callAuth, readTokens, setSessionCookies } from "@/lib/auth/session";
import { NextResponse } from "next/server";

/**
 * Changing a password revokes every session, including this browser's.
 *
 * It cannot go through the `/api/backend` proxy for that reason: the proxy deliberately
 * drops upstream cookies, so the replacement tokens would never reach the cookie jar and the
 * user would be signed out by their own password change.
 */
export async function POST(request: Request) {
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== "object") {
		return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
	}

	const { accessToken } = await readTokens();
	if (!accessToken) {
		return NextResponse.json({ message: "Not signed in" }, { status: 401 });
	}

	const result = await callAuth<BackendSession>("change-password", body, { accessToken });

	if (!result.ok) {
		return NextResponse.json({ message: result.message }, { status: result.status });
	}

	await setSessionCookies(result.data);
	return NextResponse.json({ user: result.data.user });
}
