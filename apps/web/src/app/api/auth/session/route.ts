import { getCurrentUser } from "@/lib/auth/session";
import { NextResponse } from "next/server";

/** Who is signed in, for a client that needs to re-read the session after a mutation. */
export async function GET() {
	return NextResponse.json({ user: await getCurrentUser() });
}
