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
import { Check, ChevronsUpDown, Lock, Plus, Store } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Which shop — and which branch — this device is working in (plan §27).
 *
 * Branches are always listed so the owner can see them, but switching between them is gated
 * on the MULTI_BRANCH entitlement. The lock is a hint; the API refuses regardless.
 */
export function StoreSwitcher({ collapsed = false }: { collapsed?: boolean }) {
	const t = useTranslations("storeSwitcher");
	const tRole = useTranslations("roles");
	const { business, branch, businesses } = useActiveBusiness();
	const setBusiness = useWorkspaceStore((state) => state.setBusiness);
	const setBranch = useWorkspaceStore((state) => state.setBranch);
	const multiBranch = useFeature("MULTI_BRANCH");

	const branchLabel = branch?.name ?? t("allBranches");

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				data-tour="store"
				className={cn(
					"flex w-full items-center gap-3 rounded-xl p-2 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
					collapsed && "justify-center"
				)}
				aria-label={t("label")}
			>
				<StoreAvatar name={business.name} logoUrl={business.logoUrl} />
				{collapsed ? null : (
					<>
						<span className="min-w-0 flex-1">
							<span className="block truncate font-medium text-sm leading-tight">
								{business.name}
							</span>
							<span className="flex items-center gap-1.5 text-muted-foreground text-xs">
								<span className="size-1.5 shrink-0 rounded-full bg-success" aria-hidden />
								<span className="truncate">{branchLabel}</span>
							</span>
						</span>
						<ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
					</>
				)}
			</DropdownMenuTrigger>

			<DropdownMenuContent side="top" align="start" className="w-64">
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
					{multiBranch ? null : (
						<span className="flex items-center gap-1 font-normal text-muted-foreground text-xs">
							<Lock className="size-3" />
							Business
						</span>
					)}
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
