import { type BackendSession, callAuth, setSessionCookies } from "@/lib/auth/session";
import { NextResponse } from "next/server";

/**
 * Signs in to a shared demo account by role. Same cookie handling as login; the API picks
 * the account, so no demo password ever reaches the browser.
 */
export async function POST(request: Request) {
	const body = (await request.json().catch(() => null)) as { role?: unknown } | null;
	if (!body || typeof body.role !== "string") {
		return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
	}

	const result = await callAuth<BackendSession>("demo", { role: body.role }, { userAgent: request.headers.get("user-agent") });

	if (!result.ok) {
		return NextResponse.json({ message: result.message }, { status: result.status });
	}

	await setSessionCookies(result.data);
	return NextResponse.json({ user: result.data.user });
}
