import { type BackendSession, callAuth, setSessionCookies } from "@/lib/auth/session";
import { NextResponse } from "next/server";

/**
 * Forwards credentials to the API and turns the returned tokens into first-party httpOnly
 * cookies. The tokens themselves never reach the browser's JavaScript.
 */
export async function POST(request: Request) {
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== "object") {
		return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
	}

	const result = await callAuth<BackendSession>("register", body);

	if (!result.ok) {
		return NextResponse.json({ message: result.message }, { status: result.status });
	}

	await setSessionCookies(result.data);
	return NextResponse.json({ user: result.data.user });
}
