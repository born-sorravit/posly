"use client";

import { Button } from "@posly/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@posly/ui/components/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@posly/ui/components/sheet";
import { Switch } from "@posly/ui/components/switch";
import { useMemberMutations, useRolePermissions } from "@/hooks/use-posly";
import { useActiveBusiness, useFeature } from "@/hooks/use-workspace";
import { TABLET_UP, useMediaQuery } from "@/hooks/use-media-query";
import { Link } from "@/i18n/navigation";
import { type PermissionKey, withNeeds, withoutDependents } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { Employee } from "@posly/types/domain";
import { Lock, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

/** Everything a custom list may hold: billing stays with the owner. */
type Assignable = Exclude<PermissionKey, "subscription:manage">;

/** The editor's sections, in the order a shop thinks about its staff. */
const GROUPS: { key: "selling" | "orders" | "catalog" | "money" | "shop"; permissions: Assignable[] }[] = [
	{ key: "selling", permissions: ["pos:use", "orders:discount", "customers:write", "kitchen:use"] },
	{ key: "orders", permissions: ["orders:read-own", "orders:read-all", "orders:refund", "orders:cancel"] },
	{ key: "catalog", permissions: ["products:read", "products:write", "inventory:write"] },
	{ key: "money", permissions: ["reports:read", "expenses:write"] },
	{ key: "shop", permissions: ["settings:manage", "business:manage", "branches:manage", "members:manage"] },
];

/**
 * One member's permissions, switch by switch (plan §21, Business plan). Switching one on
 * brings what it needs; switching one off takes what depends on it — the same rule the API
 * applies. Nobody can hand out a permission they do not have themselves.
 */
export function PermissionsDialog({ member, onClose }: { member: Employee; onClose: () => void }) {
	const t = useTranslations("employees.perms");
	const tRole = useTranslations("roles");
	const { can } = useActiveBusiness();
	const unlocked = useFeature("ADVANCED_PERMISSION");
	const roles = useRolePermissions();
	const { setPermissions } = useMemberMutations();
	const [selected, setSelected] = useState(() => new Set(member.permissions as PermissionKey[]));
	const wide = useMediaQuery(TABLET_UP);

	const roleDefaults = new Set((roles.data?.roles[member.role as "MANAGER" | "CASHIER" | "STAFF"] ?? []) as PermissionKey[]);
	const same = (a: Set<PermissionKey>, b: Set<PermissionKey>) => a.size === b.size && [...a].every((p) => b.has(p));
	const changed = !same(selected, new Set(member.permissions as PermissionKey[]));
	const matchesRole = roles.data ? same(selected, roleDefaults) : false;

	const toggle = (p: PermissionKey, on: boolean) =>
		setSelected((current) => (on ? withNeeds([...current, p]) : withoutDependents(current, p)));

	const save = () => {
		// Exactly the role's defaults is stored as "no custom list", so a later change to the
		// role's defaults still reaches this member.
		const permissions = matchesRole ? null : [...selected];
		setPermissions.mutate(
			{ memberId: member.id, permissions },
			{
				onSuccess: () => {
					toast.success(t("saved", { name: member.name }));
					onClose();
				},
				onError: (e) => toast.error(e.message),
			}
		);
	};

	const title = t("title", { name: member.name });
	const description = t("description", { role: tRole(member.role) });

	const body = (
		<div className="space-y-5">
			{unlocked ? (
				<div className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 py-2 pr-2 pl-4 text-sm">
					<span className="min-w-0">{matchesRole ? t("usingRole", { role: tRole(member.role) }) : t("custom")}</span>
					<Button
						variant="ghost"
						size="sm"
						className="shrink-0"
						disabled={matchesRole || !roles.data}
						onClick={() => setSelected(new Set(roleDefaults))}
					>
						<RotateCcw />
						{t("resetToRole")}
					</Button>
				</div>
			) : (
				<div className="flex flex-col gap-3 rounded-xl bg-primary/5 px-4 py-3 text-sm tablet:flex-row tablet:items-center">
					<Lock className="size-4 shrink-0 text-primary" />
					<span className="flex-1">{member.customPermissions ? t("lockedKept") : t("locked")}</span>
					<Button asChild size="sm" className="brand-gradient">
						<Link href="/settings/subscription">{t("upgrade")}</Link>
					</Button>
				</div>
			)}

			<div className="grid gap-5 tablet:grid-cols-2">
				{GROUPS.map((group) => (
					<section key={group.key} className="space-y-1.5">
						<h3 className="px-1 font-medium text-muted-foreground text-xs">{t(`groups.${group.key}`)}</h3>
						<ul className="divide-y rounded-xl border">
							{group.permissions.map((p) => {
								const mine = can(p);
								const disabled = !unlocked || !mine || setPermissions.isPending;
								return (
									<li key={p}>
										<label
											className={cn(
												"flex items-center gap-3 px-3.5 py-3",
												disabled ? "cursor-not-allowed" : "cursor-pointer"
											)}
										>
											<span className="min-w-0 flex-1">
												<span className={cn("block font-medium text-sm", !mine && "text-muted-foreground")}>
													{t(`list.${p}.title`)}
												</span>
												<span className="block text-muted-foreground text-xs">
													{mine ? t(`list.${p}.hint`) : t("notYours")}
												</span>
											</span>
											<Switch
												checked={selected.has(p)}
												disabled={disabled}
												onCheckedChange={(on) => toggle(p, on)}
											/>
										</label>
									</li>
								);
							})}
						</ul>
					</section>
				))}
			</div>
			<p className="px-1 text-muted-foreground text-xs">{t("billingNote")}</p>
		</div>
	);

	// Stays put while the list scrolls. On a phone: the count on its own line, then the two
	// buttons side by side at full width; from tablet up, one row.
	const footer = (
		<div className="flex shrink-0 flex-col gap-3 border-t bg-muted/40 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] tablet:flex-row tablet:items-center tablet:px-6 tablet:py-4">
			<span className="text-muted-foreground text-xs tablet:mr-auto">{t("count", { count: selected.size })}</span>
			<div className={cn("grid gap-2 tablet:flex", unlocked ? "grid-cols-2" : "grid-cols-1")}>
				<Button variant="outline" size="lg" className="h-11 tablet:h-10" onClick={onClose}>
					{t("cancel")}
				</Button>
				{unlocked ? (
					<Button
						size="lg"
						className="brand-gradient h-11 tablet:h-10"
						disabled={!changed || setPermissions.isPending}
						onClick={save}
					>
						{t("save")}
					</Button>
				) : null}
			</div>
		</div>
	);

	if (!wide) {
		return (
			<Sheet open onOpenChange={(open) => !open && onClose()}>
				<SheetContent side="bottom" className="gap-0 rounded-t-3xl p-0 data-[side=bottom]:h-[92svh]">
					<span aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
					<SheetHeader className="shrink-0 gap-1 px-5 pt-3 pb-4 pr-12 text-left">
						<SheetTitle className="text-lg">{title}</SheetTitle>
						<SheetDescription className="text-pretty">{description}</SheetDescription>
					</SheetHeader>
					<div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{body}</div>
					{footer}
				</SheetContent>
			</Sheet>
		);
	}

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="flex max-h-[92svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
				<DialogHeader className="shrink-0 px-6 pt-6 pb-4">
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{body}</div>
				{footer}
			</DialogContent>
		</Dialog>
	);
}
