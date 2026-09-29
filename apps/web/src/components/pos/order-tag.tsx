"use client";

import { Input } from "@posly/ui/components/input";
import { useActiveBusiness } from "@/hooks/use-workspace";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/stores/cart-store";
import type { ServiceType } from "@posly/types/domain";
import { Bike, ShoppingBag, UtensilsCrossed } from "lucide-react";
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

	return (
		<div className="flex items-center gap-1.5 px-4 pb-2">
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
				placeholder={kinds ? t("labelPlaceholder") : t("labelPlaceholderShop")}
				aria-label={t("label")}
				className="h-8 min-w-0 flex-1 rounded-full px-3 text-xs"
			/>
		</div>
	);
}

/** "กลับบ้าน · คิว 12" wherever an order is shown after the sale. */
export function useOrderTag() {
	const t = useTranslations("pos.tag");
	return (order: { serviceType?: ServiceType | null; label?: string | null }) =>
		[order.serviceType ? t(order.serviceType) : null, order.label].filter(Boolean).join(" · ");
}
