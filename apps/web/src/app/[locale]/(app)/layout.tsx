import { AppShell } from "@/components/layout/app-shell";
import { fetchMyBusinesses } from "@/lib/api/server";
import { requireUser } from "@/lib/auth/require-user";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Every signed-in screen. Signed out → login; signed in with no shop yet → onboarding
 * (plan §6: never an empty dashboard). Membership is re-checked by the API on every call;
 * this is only where to send people.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
	await requireUser("/dashboard");
	const businesses = await fetchMyBusinesses();
	if (businesses && businesses.length === 0) redirect("/onboarding");

	return <AppShell initialBusinesses={businesses ?? []}>{children}</AppShell>;
}
