"use client";

import { EmptyState, PageContainer } from "@/components/common/primitives";
import { Alert, AlertDescription, AlertTitle } from "@posly/ui/components/alert";
import { Button } from "@posly/ui/components/button";
import { useActiveBusiness } from "@/hooks/use-workspace";
import { Link, usePathname } from "@/i18n/navigation";
import { type PermissionKey, permissionForPath } from "@/lib/permissions";
import { Eye, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/**
 * The explanation shown in place of a screen the member may not use: what it needs, what
 * they are, and where they can go instead — before they type anything into a form the API
 * would refuse.
 */
export function NoAccess({ permission }: { permission: PermissionKey }) {
	const t = useTranslations("access");
	const tPerm = useTranslations("permissions");
	const tRole = useTranslations("roles");
	const { business, can } = useActiveBusiness();

	return (
		<PageContainer>
			<EmptyState
				icon={Lock}
				title={t("title")}
				description={t("description", {
					permission: tPerm(permission),
					role: tRole(business.role),
					business: business.name,
				})}
				action={
					<div className="flex flex-wrap justify-center gap-2">
						{can("pos:use") ? (
							<Button asChild size="lg" className="brand-gradient">
								<Link href="/pos">{t("toPos")}</Link>
							</Button>
						) : null}
						<Button variant="outline" size="lg" onClick={() => window.history.back()}>
							{t("back")}
						</Button>
					</div>
				}
			/>
			<p className="text-center text-muted-foreground text-xs">{t("askOwner")}</p>
		</PageContainer>
	);
}

/** Wraps every app screen; blocks the ones the member's permissions do not cover. */
export function RouteGate({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const { can } = useActiveBusiness();
	const permission = permissionForPath(pathname);

	if (permission && !can(permission)) return <NoAccess permission={permission} />;
	return <>{children}</>;
}

/**
 * For a screen the member may look at but not change (a cashier opening a product): says so
 * up front, before any field invites an edit.
 */
export function ReadOnlyNotice({ permission }: { permission: PermissionKey }) {
	const t = useTranslations("access");
	const tPerm = useTranslations("permissions");
	return (
		<Alert className="rounded-2xl border-warning/40 bg-warning/10">
			<Eye className="size-4" />
			<AlertTitle>{t("readOnlyTitle")}</AlertTitle>
			<AlertDescription>{t("readOnlyHint", { permission: tPerm(permission) })}</AlertDescription>
		</Alert>
	);
}
