import { NoAccess } from "@/components/auth/no-access";
import { AppShell } from "@/components/shell/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Every monitor page sits behind this. The API enforces the admin flag on each request
 * anyway; checking here as well just saves a non-admin a screen full of errors.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
	const user = await getCurrentUser();
	if (!user) redirect("/login");
	if (!user.isPlatformAdmin) return <NoAccess email={user.email} />;
	return <AppShell user={user}>{children}</AppShell>;
}
