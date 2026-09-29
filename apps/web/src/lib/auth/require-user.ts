import "server-only";

import { getCurrentUser } from "@/lib/auth/session";
import type { AuthUser } from "@posly/types/api";
import { redirect } from "next/navigation";

/**
 * The gate for a protected page.
 *
 * Kept in one place so every protected route bounces the same way and comes back to where
 * the user was heading. `next` is a path on this site, and `AuthForm` only honours values
 * starting with `/`, so it cannot be used to redirect someone off-site after signing in.
 */
export async function requireUser(returnTo: string): Promise<AuthUser> {
	const user = await getCurrentUser();

	if (!user) {
		redirect(`/login?next=${encodeURIComponent(returnTo)}`);
	}

	return user;
}
