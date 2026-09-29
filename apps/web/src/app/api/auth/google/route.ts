import { type BackendSession, callAuth, setSessionCookies } from "@/lib/auth/session";
import { NextResponse } from "next/server";

/** Exchanges a Google ID token for a Posly session, stored as first-party httpOnly cookies. */
export async function POST(request: Request) {
	const body = (await request.json().catch(() => null)) as { idToken?: unknown } | null;
	if (!body || typeof body.idToken !== "string") {
		return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
	}

	const result = await callAuth<BackendSession>("google", { idToken: body.idToken });

	if (!result.ok) {
		return NextResponse.json({ message: result.message }, { status: result.status });
	}

	await setSessionCookies(result.data);
	return NextResponse.json({ user: result.data.user });
}
