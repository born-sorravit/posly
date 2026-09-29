"use client";

import { ProductThumb } from "@/components/common/product-thumb";
import { stockStatus } from "@/lib/stock";
import { formatBaht } from "@posly/utils/money";
import { cn } from "@/lib/utils";
import type { Product } from "@posly/types/domain";
import { Plus, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo } from "react";

/**
 * One tap adds (plan §9). The whole card is the button — a 44px "+" alone is too small a
 * target for a busy counter — and it presses in on touch so the cashier feels it register.
 *
 * Memoised: a grid of 40 cards re-rendering on every cart change is exactly the lag the POS
 * must not have.
 */
export const ProductCard = memo(function ProductCard({
	product,
	onSelect,
	inCart = 0,
}: {
	product: Product;
	onSelect: (product: Product) => void;
	/** How many are already in this cart — the shelf count minus these is what can still sell. */
	inCart?: number;
}) {
	const t = useTranslations("pos");
	const status = stockStatus(product);
	const soldOut = status === "OUT_OF_STOCK";
	const left = product.trackStock && product.stock !== null ? product.stock - inCart : null;
	// Everything on the shelf is already in this cart: nothing more to add, but not "sold out".
	const allInCart = !soldOut && left !== null && left <= 0;
	const hasOptions = product.modifierGroups.length > 0;

	return (
		<button
			type="button"
			disabled={soldOut || allInCart}
			onClick={() => onSelect(product)}
			className={cn(
				"surface surface-hover group touch-target @container relative flex flex-col gap-2 rounded-2xl p-2 text-left",
				"hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:active:scale-100",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
			)}
		>
			<div className="relative">
				<ProductThumb
					art={product.art}
					imageUrl={product.imageUrl}
					name={product.name}
					className="aspect-[4/3] w-full"
				/>
				{!soldOut && !allInCart && left !== null && (status === "LOW_STOCK" || inCart > 0) ? (
					<span
						className={cn(
							"absolute top-2 left-2 rounded-md px-1.5 py-0.5 font-semibold text-[10px]",
							status === "LOW_STOCK" || left <= 3 ? "bg-warning text-warning-foreground" : "bg-background/80 text-foreground"
						)}
					>
						{t("lowStockLeft", { count: left })}
					</span>
				) : null}
				{allInCart ? (
					<span className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/55 px-2 text-center font-semibold text-xs backdrop-blur-[1px]">
						{t("allInCart", { count: product.stock ?? 0 })}
					</span>
				) : null}
				{soldOut ? (
					<span className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/50 font-semibold text-sm backdrop-blur-[1px]">
						{t("soldOut")}
					</span>
				) : null}
			</div>

			<div className="flex items-end justify-between gap-2 px-1 pb-0.5">
				<div className="min-w-0">
					<p className="truncate font-medium text-sm leading-snug">{product.name}</p>
					<p className="flex min-w-0 items-baseline gap-1.5 text-sm">
						<span className="numeric shrink-0 font-semibold">{formatBaht(product.price)}</span>
						{/* On the price line, so the picture stays clear and the card no taller: a
						    choice (size, sweetness…) comes before it goes in the cart. */}
						{hasOptions ? (
							// Words where the card has room for them, a small icon where it does not,
							// so it never truncates to "มีตัวเ…".
							// 9.5rem is where "฿80 · มีตัวเลือก" fits beside the add button (phones, 1024,
							// 1440 and up); the grid is narrower beside the cart at 768 and 1280.
							<span
								className="flex min-w-0 items-center gap-1 text-muted-foreground text-xs"
								title={t("hasOptions")}
							>
								<span aria-hidden>·</span>
								<SlidersHorizontal className="size-3 shrink-0 @min-[9.5rem]:hidden" aria-hidden />
								<span className="sr-only @min-[9.5rem]:not-sr-only @min-[9.5rem]:truncate">{t("hasOptions")}</span>
							</span>
						) : null}
					</p>
				</div>
				<span
					className={cn(
						"flex size-8 shrink-0 items-center justify-center rounded-full transition-colors",
						"bg-accent text-primary group-hover:bg-primary group-hover:text-primary-foreground"
					)}
					aria-hidden
				>
					{/* One action for every card: it adds. The price line says whether a choice
					    comes first. */}
					<Plus className="size-4" />
				</span>
			</div>
		</button>
	);
});
