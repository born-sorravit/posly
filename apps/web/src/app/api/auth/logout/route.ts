import { callAuth, clearSessionCookies, readTokens } from "@/lib/auth/session";
import { NextResponse } from "next/server";

export async function POST() {
	const { refreshToken } = await readTokens();

	// Revoke server-side first, then drop the cookies. If the API call fails the cookies are
	// still cleared — a user who asked to sign out must end up signed out locally either way.
	if (refreshToken) {
		await callAuth("logout", { refreshToken }).catch(() => undefined);
	}

	await clearSessionCookies();
	return NextResponse.json({ ok: true });
}
