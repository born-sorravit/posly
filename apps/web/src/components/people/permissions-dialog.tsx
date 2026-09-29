"use client";

import { Button } from "@posly/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@posly/ui/components/dialog";
import { Switch } from "@posly/ui/components/switch";
import { useMemberMutations, useRolePermissions } from "@/hooks/use-posly";
import { useActiveBusiness, useFeature } from "@/hooks/use-workspace";
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

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-h-[92svh] gap-5 overflow-y-auto p-6 sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>{t("title", { name: member.name })}</DialogTitle>
					<DialogDescription>{t("description", { role: tRole(member.role) })}</DialogDescription>
				</DialogHeader>

				{unlocked ? (
					<div className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-4 py-3 text-sm">
						<span>{matchesRole ? t("usingRole", { role: tRole(member.role) }) : t("custom")}</span>
						<Button
							variant="ghost"
							size="sm"
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
				<p className="text-muted-foreground text-xs">{t("billingNote")}</p>

				<DialogFooter className="-mx-6 -mb-6 mt-1 items-center px-6 py-4">
					<span className="mr-auto text-muted-foreground text-xs">{t("count", { count: selected.size })}</span>
					<Button variant="outline" size="lg" onClick={onClose}>
						{t("cancel")}
					</Button>
					{unlocked ? (
						<Button size="lg" className="brand-gradient" disabled={!changed || setPermissions.isPending} onClick={save}>
							{t("save")}
						</Button>
					) : null}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
