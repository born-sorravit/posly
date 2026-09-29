"use client";

import { StoreAvatar } from "@/components/layout/brand";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@posly/ui/components/dropdown-menu";
import { useActiveBusiness, useFeature } from "@/hooks/use-workspace";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { TABLET_UP, useMediaQuery } from "@/hooks/use-media-query";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@posly/ui/components/sheet";
import { Check, ChevronsUpDown, Lock, Plus, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

/**
 * Which shop — and which branch — this device is working in (plan §27).
 *
 * Branches are always listed so the owner can see them, but switching between them is gated
 * on the MULTI_BRANCH entitlement. The lock is a hint; the API refuses regardless.
 *
 * `placement="header"` is the copy in the top bar for phones, where there is no sidebar: a
 * tighter trigger, and on a phone the list is a bottom drawer like the user menu.
 */
export function StoreSwitcher({
	collapsed = false,
	placement = "sidebar",
}: {
	collapsed?: boolean;
	placement?: "sidebar" | "header";
}) {
	const inHeader = placement === "header";
	const t = useTranslations("storeSwitcher");
	const tRole = useTranslations("roles");
	const { business, branch, businesses } = useActiveBusiness();
	const setBusiness = useWorkspaceStore((state) => state.setBusiness);
	const setBranch = useWorkspaceStore((state) => state.setBranch);
	const multiBranch = useFeature("MULTI_BRANCH");

	const branchLabel = branch?.name ?? t("allBranches");
	const wide = useMediaQuery(TABLET_UP);
	const asDrawer = inHeader && !wide;
	const [drawerOpen, setDrawerOpen] = useState(false);

	const trigger = (
		<button
			type="button"
			data-tour="store"
			className={cn(
				"flex w-full items-center gap-3 rounded-xl p-2 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
				collapsed && "justify-center",
				inHeader && "-ml-2 w-auto max-w-full gap-2.5 p-1.5"
			)}
			aria-label={t("label")}
		>
			<StoreAvatar name={business.name} logoUrl={business.logoUrl} className={inHeader ? "size-8" : undefined} />
			{collapsed ? null : (
				<>
					<span className="min-w-0 flex-1">
						<span className="block truncate font-medium text-sm leading-tight">{business.name}</span>
						<span className="flex items-center gap-1.5 text-muted-foreground text-xs">
							<span className="size-1.5 shrink-0 rounded-full bg-success" aria-hidden />
							<span className="truncate">{branchLabel}</span>
						</span>
					</span>
					<ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
				</>
			)}
		</button>
	);

	const lockBadge = multiBranch ? null : (
		<span className="flex items-center gap-1 font-normal text-muted-foreground text-xs">
			<Lock className="size-3" />
			Business
		</span>
	);

	if (asDrawer) {
		const row =
			"flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left font-medium text-[15px] transition-colors active:bg-muted disabled:opacity-50";
		const pick = (fn: () => void) => () => {
			fn();
			setDrawerOpen(false);
		};
		return (
			<Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
				<SheetTrigger asChild>{trigger}</SheetTrigger>
				<SheetContent
					side="bottom"
					showCloseButton={false}
					className="max-h-[85svh] gap-0 overflow-y-auto rounded-t-3xl px-3 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]"
				>
					<span aria-hidden className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
					<SheetTitle className="px-3 pb-1 text-muted-foreground text-xs">{t("stores")}</SheetTitle>
					<SheetDescription className="sr-only">{t("label")}</SheetDescription>
					<div className="pb-2">
						{businesses.map((b) => (
							<button key={b.id} type="button" className={row} onClick={pick(() => setBusiness(b.id))}>
								<StoreAvatar name={b.name} logoUrl={b.logoUrl} className="size-8 rounded-lg text-sm" />
								<span className="min-w-0 flex-1 truncate">{b.name}</span>
								<span className="font-normal text-muted-foreground text-xs">{tRole(b.role)}</span>
								{b.id === business.id ? <Check className="size-5 text-primary" /> : <span className="size-5" />}
							</button>
						))}
					</div>

					<div className="border-t py-2">
						<div className="flex items-center justify-between px-3 py-1.5 text-muted-foreground text-xs">
							{t("branches")}
							{lockBadge}
						</div>
						<button type="button" disabled={!multiBranch} className={row} onClick={pick(() => setBranch(null))}>
							<Store className="size-5 text-muted-foreground" />
							<span className="flex-1">{t("allBranches")}</span>
							{branch === null ? <Check className="size-5 text-primary" /> : null}
						</button>
						{business.branches.map((b) => (
							<button
								key={b.id}
								type="button"
								disabled={!multiBranch && !b.isDefault}
								className={row}
								onClick={pick(() => setBranch(b.id))}
							>
								<span className="size-5" aria-hidden />
								<span className="min-w-0 flex-1 truncate">{b.name}</span>
								{branch?.id === b.id ? <Check className="size-5 text-primary" /> : null}
							</button>
						))}
					</div>

					<div className="border-t pt-2">
						<Link href="/onboarding" className={row} onClick={() => setDrawerOpen(false)}>
							<Plus className="size-5 text-muted-foreground" />
							{t("newStore")}
						</Link>
					</div>
				</SheetContent>
			</Sheet>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>

			<DropdownMenuContent side={inHeader ? "bottom" : "top"} align="start" className="w-64">
				<DropdownMenuLabel>{t("stores")}</DropdownMenuLabel>
				{businesses.map((b) => (
					<DropdownMenuItem key={b.id} onClick={() => setBusiness(b.id)}>
						<StoreAvatar name={b.name} logoUrl={b.logoUrl} className="size-6 rounded-md text-xs" />
						<span className="flex-1 truncate">{b.name}</span>
						<span className="text-muted-foreground text-xs">{tRole(b.role)}</span>
						{b.id === business.id ? <Check className="size-4 text-primary" /> : null}
					</DropdownMenuItem>
				))}

				<DropdownMenuSeparator />
				<DropdownMenuLabel className="flex items-center justify-between">
					{t("branches")}
					{lockBadge}
				</DropdownMenuLabel>
				<DropdownMenuItem disabled={!multiBranch} onClick={() => setBranch(null)}>
					<Store className="size-4" />
					<span className="flex-1">{t("allBranches")}</span>
					{branch === null ? <Check className="size-4 text-primary" /> : null}
				</DropdownMenuItem>
				{business.branches.map((b) => (
					<DropdownMenuItem
						key={b.id}
						disabled={!multiBranch && !b.isDefault}
						onClick={() => setBranch(b.id)}
					>
						<span className="size-4" aria-hidden />
						<span className="flex-1 truncate">{b.name}</span>
						{branch?.id === b.id ? <Check className="size-4 text-primary" /> : null}
					</DropdownMenuItem>
				))}

				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link href="/onboarding">
						<Plus className="size-4" />
						{t("newStore")}
					</Link>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
