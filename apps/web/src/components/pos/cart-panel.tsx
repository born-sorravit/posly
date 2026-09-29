"use client";

import { EmptyState } from "@/components/common/primitives";
import { ProductThumb } from "@/components/common/product-thumb";
import { Button } from "@posly/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@posly/ui/components/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@posly/ui/components/tooltip";
import { DiscountControl } from "@/components/pos/discount-control";
import { useSubscription } from "@/components/providers/workspace-provider";
import { CustomerPicker } from "@/components/pos/customer-picker";
import { OrderTag } from "@/components/pos/order-tag";
import { useActiveBusiness } from "@/hooks/use-workspace";
import { formatBaht, multiply } from "@posly/utils/money";
import { cn } from "@/lib/utils";
import { type CartLine, type CartTotals, remainingStock, useCartStore } from "@/stores/cart-store";
import {
	ArrowRight,
	MoreHorizontal,
	Minus,
	Plus,
	ShoppingBasket,
	StickyNote,
	Trash2,
	TriangleAlert,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

function QtyButton({
	onClick,
	label,
	shortcut,
	disabled = false,
	children,
}: {
	onClick: () => void;
	label: string;
	shortcut?: string;
	disabled?: boolean;
	children: React.ReactNode;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					// Not the native `disabled`: a disabled button gets no pointer events, so the
					// tooltip explaining why it will not add would never appear.
					onClick={disabled ? undefined : onClick}
					aria-label={label}
					aria-disabled={disabled}
					className={cn(
						"touch-target flex size-8 items-center justify-center rounded-lg bg-muted text-foreground transition-colors",
						disabled ? "cursor-not-allowed opacity-40" : "hover:bg-accent hover:text-primary active:scale-95"
					)}
				>
					{children}
				</button>
			</TooltipTrigger>
			<TooltipContent>
				{label}
				{shortcut ? <kbd className="ml-1 font-mono">{shortcut}</kbd> : null}
			</TooltipContent>
		</Tooltip>
	);
}

/** Inline, under the line: a popover nested in the item menu would close with the menu. */
function NoteEditor({ line, onDone }: { line: CartLine; onDone: () => void }) {
	const t = useTranslations("pos");
	const setNote = useCartStore((state) => state.setNote);
	const [value, setValue] = useState(line.note ?? "");

	const save = () => {
		setNote(line.key, value.trim() || null);
		onDone();
	};

	return (
		<div className="flex gap-1.5">
			<input
				// biome-ignore lint/a11y/noAutofocus: opened by an explicit "add note" action
				autoFocus
				value={value}
				onChange={(event) => setValue(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter") save();
					if (event.key === "Escape") onDone();
				}}
				placeholder={t("notePlaceholder")}
				className="h-8 min-w-0 flex-1 rounded-lg border bg-card px-2.5 text-xs outline-none focus:border-primary/50"
			/>
			<Button size="sm" onClick={save}>
				{t("saveNote")}
			</Button>
		</div>
	);
}

export function CartItem({ line, active }: { line: CartLine; active: boolean }) {
	const t = useTranslations("pos");
	const increment = useCartStore((state) => state.increment);
	const decrement = useCartStore((state) => state.decrement);
	const remove = useCartStore((state) => state.remove);
	const [editingNote, setEditingNote] = useState(false);
	const remaining = useCartStore((state) => remainingStock(state, line.productId));
	const atLimit = remaining !== null && remaining <= 0;
	// Another till sold some after this was added: say so before checkout refuses it.
	const short = remaining !== null && remaining < 0;

	const detail = [
		...line.modifiers.map((m) => m.optionName),
		line.note ? `“${line.note}”` : null,
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<motion.li
			layout
			initial={{ opacity: 0, y: -6 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, x: 24, transition: { duration: 0.15 } }}
			transition={{ duration: 0.18 }}
			className={cn(
				"flex gap-3 rounded-2xl p-2.5 transition-colors",
				active ? "bg-accent/60" : "hover:bg-muted/60"
			)}
		>
			<ProductThumb art={line.art} name={line.name} className="size-12" rounded="rounded-xl" />
			<div className="min-w-0 flex-1 space-y-1.5">
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0">
						<p className="truncate font-medium text-sm leading-tight">{line.name}</p>
						<p className="truncate text-muted-foreground text-xs">
							{detail || formatBaht(line.unitPrice)}
						</p>
					</div>
					<p className="numeric shrink-0 font-semibold text-sm">
						{formatBaht(multiply(line.unitPrice, line.quantity))}
					</p>
				</div>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-1">
						<QtyButton onClick={() => decrement(line.key)} label={t("decrease")} shortcut="−">
							<Minus className="size-3.5" />
						</QtyButton>
						<span className="numeric w-8 text-center font-semibold text-sm">{line.quantity}</span>
						<QtyButton
							onClick={() => increment(line.key)}
							label={atLimit ? t("noMoreStock") : t("increase")}
							shortcut={atLimit ? undefined : "+"}
							disabled={atLimit}
						>
							<Plus className="size-3.5" />
						</QtyButton>
					</div>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon-sm" aria-label={t("itemActions")}>
								<MoreHorizontal />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-44">
							<DropdownMenuItem onClick={() => setEditingNote(true)}>
								<StickyNote className="size-4" />
								{t("note")}
							</DropdownMenuItem>
							<DropdownMenuItem variant="destructive" onClick={() => remove(line.key)}>
								<Trash2 className="size-4" />
								{t("remove")}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
				{short ? (
					<p className="text-danger text-xs">{t("stockShort", { count: line.quantity + (remaining ?? 0) })}</p>
				) : atLimit ? (
					<p className="text-muted-foreground text-xs">{t("stockAllInCart")}</p>
				) : null}
				{editingNote ? <NoteEditor line={line} onDone={() => setEditingNote(false)} /> : null}
			</div>
		</motion.li>
	);
}

/**
 * The order being rung up (plan §10): lines, a short summary, and the one big button.
 * Used as the right column from tablet up and inside a bottom sheet on a phone.
 */
/** Below this many orders left in the month, the cart says so. */
const QUOTA_WARNING = 10;

export function CartPanel({
	totals,
	vatBasisPoints,
	onCheckout,
	className,
}: {
	totals: CartTotals;
	vatBasisPoints: number;
	onCheckout: () => void;
	className?: string;
}) {
	const t = useTranslations("pos");
	const lines = useCartStore((state) => state.lines);
	const activeKey = useCartStore((state) => state.activeKey);
	const clear = useCartStore((state) => state.clear);
	const empty = lines.length === 0;
	// The API refuses a discount without this permission; do not offer one.
	const canDiscount = useActiveBusiness().can("orders:discount");
	// Said before the sale, not after it fails: how many orders the plan has left this month.
	const { limits, usage } = useSubscription();
	const ordersLeft = limits.orders === null ? null : Math.max(0, limits.orders - usage.ordersThisMonth);
	const outOfOrders = ordersLeft === 0;

	return (
		<div className={cn("flex min-h-0 flex-col", className)}>
			<div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
				<div>
					<p className="font-semibold text-base">{t("currentOrder")}</p>
					<p className="text-muted-foreground text-xs">{t("newOrderHint")}</p>
				</div>
				<div className="flex items-center gap-1">
					<span data-tour="pos-customer" className="contents">
						<CustomerPicker />
					</span>
					{empty ? null : (
						<Button variant="ghost" size="icon-sm" onClick={clear} aria-label={t("clearCart")}>
							<Trash2 />
						</Button>
					)}
				</div>
			</div>
			<OrderTag />

			<div className="min-h-0 flex-1 overflow-y-auto px-2">
				{empty ? (
					<EmptyState
						icon={ShoppingBasket}
						title={t("emptyCart")}
						description={t("emptyCartHint")}
						className="py-12"
					/>
				) : (
					<ul className="grid gap-1 pb-2">
						<AnimatePresence initial={false}>
							{lines.map((line) => (
								<CartItem key={line.key} line={line} active={line.key === activeKey} />
							))}
						</AnimatePresence>
					</ul>
				)}
			</div>

			<div className="m-2 space-y-3 rounded-2xl bg-muted/50 px-4 pt-3 pb-4 dark:bg-white/[0.03]">
				<dl className="numeric grid gap-1.5 text-sm">
					<div className="flex justify-between text-muted-foreground">
						<dt>{t("subtotal", { count: totals.itemCount })}</dt>
						<dd>{formatBaht(totals.subtotal)}</dd>
					</div>
					{canDiscount ? <DiscountControl subtotal={totals.subtotal} off={totals.discount} /> : null}
					{vatBasisPoints > 0 ? (
						<div className="flex justify-between text-muted-foreground">
							<dt>{t("vat", { rate: vatBasisPoints / 100 })}</dt>
							<dd>{formatBaht(totals.vat)}</dd>
						</div>
					) : null}
					<div className="flex items-baseline justify-between pt-1.5">
						<dt className="font-semibold text-base">{t("total")}</dt>
						<dd className="font-bold text-2xl tracking-tight">{formatBaht(totals.total)}</dd>
					</div>
				</dl>

				{ordersLeft !== null && ordersLeft <= QUOTA_WARNING ? (
					<p
						role="status"
						className={cn(
							"mb-2 flex items-start gap-2 rounded-xl px-3 py-2 text-xs",
							outOfOrders ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"
						)}
					>
						<TriangleAlert className="mt-px size-3.5 shrink-0" />
						<span>
							{outOfOrders
								? t("quotaReached", { limit: limits.orders ?? 0 })
								: t("quotaLow", { count: ordersLeft, limit: limits.orders ?? 0 })}
						</span>
					</p>
				) : null}
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							data-tour="pos-checkout"
							disabled={empty || outOfOrders}
							onClick={onCheckout}
							className="brand-gradient touch-target h-14 w-full rounded-2xl font-semibold text-base shadow-md transition-transform active:scale-[0.98]"
						>
							<span className="flex-1 text-left">{t("checkout")}</span>
							<span className="numeric">{formatBaht(totals.total)}</span>
							<ArrowRight className="size-5" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						{t("checkout")} <kbd className="ml-1 font-mono">Enter</kbd>
					</TooltipContent>
				</Tooltip>
			</div>
		</div>
	);
}
