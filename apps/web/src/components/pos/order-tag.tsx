"use client";

import { Input } from "@posly/ui/components/input";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@posly/ui/components/dropdown-menu";
import { useTableBoard } from "@/hooks/use-posly";
import { useActiveBusiness } from "@/hooks/use-workspace";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/stores/cart-store";
import type { ServiceType } from "@posly/types/domain";
import { Bike, ChevronDown, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { formatBaht } from "@posly/utils/money";
import { useTranslations } from "next-intl";

export const SERVICE_ICON: Record<ServiceType, typeof Bike> = {
	DINE_IN: UtensilsCrossed,
	TAKEAWAY: ShoppingBag,
	DELIVERY: Bike,
};

/**
 * How this order leaves the counter, and what to call it out as (plan §27). Both optional:
 * tapping the chosen kind again clears it. A shop that sells off the shelf never sees the
 * kinds — only the label, for a name or a queue number.
 */
export function OrderTag() {
	const t = useTranslations("pos.tag");
	const { business } = useActiveBusiness();
	const serviceType = useCartStore((s) => s.serviceType);
	const setServiceType = useCartStore((s) => s.setServiceType);
	const label = useCartStore((s) => s.label);
	const setLabel = useCartStore((s) => s.setLabel);
	const kinds = business.businessType !== "RETAIL" && business.businessType !== "SERVICE";
	// With real tables the label is for a name or a queue number; a table is picked below.
	const tables = useTableBoard(kinds).data ?? [];
	const openTabs = tables.filter((table) => table.tab);
	const setTable = useCartStore((s) => s.setTable);

	return (
		<div className="space-y-2 px-4 pb-2">
			<div className="flex items-center gap-1.5">
				{kinds
					? (Object.keys(SERVICE_ICON) as ServiceType[]).map((kind) => {
							const Icon = SERVICE_ICON[kind];
							const on = serviceType === kind;
							return (
								<button
									key={kind}
									type="button"
									aria-pressed={on}
									onClick={() => setServiceType(on ? null : kind)}
									className={cn(
										"flex h-8 items-center gap-1 rounded-full px-2.5 font-medium text-xs transition-colors",
										on ? "bg-primary text-primary-foreground" : "bg-muted/70 text-muted-foreground hover:bg-muted"
									)}
								>
									<Icon className="size-3.5" />
									{t(kind)}
								</button>
							);
						})
					: null}
				<Input
					value={label}
					maxLength={40}
					onChange={(e) => setLabel(e.target.value)}
					placeholder={
						!kinds ? t("labelPlaceholderShop") : tables.length > 0 ? t("labelPlaceholderTables") : t("labelPlaceholder")
					}
					aria-label={t("label")}
					className="h-8 min-w-0 flex-1 rounded-full px-3 text-xs"
				/>
			</div>
			{openTabs.length > 0 ? (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className="flex h-9 w-full items-center gap-2 rounded-xl border border-primary/40 border-dashed px-3 font-medium text-primary text-sm transition-colors hover:border-primary hover:bg-primary/10"
						>
							<UtensilsCrossed className="size-4" />
							<span className="flex-1 text-left">{t("pickTable", { count: openTabs.length })}</span>
							<ChevronDown className="size-4" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="max-h-72 w-(--radix-dropdown-menu-trigger-width) overflow-y-auto">
						<DropdownMenuLabel className="text-muted-foreground text-xs">{t("pickTableHint")}</DropdownMenuLabel>
						{openTabs.map((table) => (
							<DropdownMenuItem
								key={table.id}
								className="h-10"
								onClick={() => table.tab && setTable({ sessionId: table.tab.id, name: table.name })}
							>
								<UtensilsCrossed />
								<span className="flex-1 font-medium">{table.name}</span>
								<span className="numeric text-muted-foreground text-xs">{formatBaht(table.tab?.total ?? 0)}</span>
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			) : null}
		</div>
	);
}

/** "กลับบ้าน · คิว 12" wherever an order is shown after the sale. */
export function useOrderTag() {
	const t = useTranslations("pos.tag");
	return (order: { serviceType?: ServiceType | null; label?: string | null }) =>
		[order.serviceType ? t(order.serviceType) : null, order.label].filter(Boolean).join(" · ");
}
