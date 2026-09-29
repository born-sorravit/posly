import {
	type BackendSession,
	callAuth,
	clearSessionCookies,
	readTokens,
	setSessionCookies,
} from "@/lib/auth/session";
import { NextResponse } from "next/server";

/**
 * Rotates the session.
 *
 * The one place besides login that writes session cookies. A failure clears them rather
 * than leaving a token that can never succeed — the refresh token is single-use, so a
 * rejected one is dead for good.
 */
export async function POST() {
	const { refreshToken } = await readTokens();
	if (!refreshToken) {
		return NextResponse.json({ message: "No session" }, { status: 401 });
	}

	const result = await callAuth<BackendSession>("refresh", { refreshToken });

	if (!result.ok) {
		await clearSessionCookies();
		return NextResponse.json({ message: result.message }, { status: 401 });
	}

	await setSessionCookies(result.data);
	return NextResponse.json({ user: result.data.user });
}
