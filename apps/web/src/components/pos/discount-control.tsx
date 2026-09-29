"use client";

import { Button } from "@posly/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@posly/ui/components/popover";
import { formatBaht, fromBaht, type Satang } from "@posly/utils/money";
import { cn } from "@/lib/utils";
import { type Discount, resolveDiscount, useCartStore } from "@/stores/cart-store";
import { Pencil, Tag, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

type Mode = "percent" | "amount";

const PERCENT_PRESETS = [5, 10, 15, 20, 50];
const BAHT_PRESETS = [5, 10, 20, 50, 100];

const describe = (discount: Discount) =>
	discount.kind === "percent" ? `${discount.basisPoints / 100}%` : formatBaht(discount.amount);

/** Turns what the cashier typed into a discount, or an error key when it cannot apply. */
const parse = (mode: Mode, text: string, subtotal: Satang): { discount: Discount } | { error: string } | null => {
	if (text.trim() === "") return null;
	const value = Number.parseFloat(text);
	if (Number.isNaN(value) || value <= 0) return { error: "discountInvalid" };
	if (mode === "percent") {
		if (value > 100) return { error: "discountOverPercent" };
		return { discount: { kind: "percent", basisPoints: Math.round(value * 100) } };
	}
	const amount = fromBaht(value);
	if (amount > subtotal) return { error: "discountOverTotal" };
	return { discount: { kind: "amount", amount } };
};

function DiscountEditor({
	subtotal,
	current,
	onDone,
}: {
	subtotal: Satang;
	current: Discount | null;
	onDone: () => void;
}) {
	const t = useTranslations("pos");
	const setDiscount = useCartStore((state) => state.setDiscount);
	const [mode, setMode] = useState<Mode>(current?.kind ?? "percent");
	const [text, setText] = useState(() =>
		current ? String(current.kind === "percent" ? current.basisPoints / 100 : current.amount / 100) : ""
	);

	const parsed = parse(mode, text, subtotal);
	const preview = parsed && "discount" in parsed ? resolveDiscount(parsed.discount, subtotal) : null;

	const apply = (discount: Discount) => {
		setDiscount(discount);
		onDone();
	};

	const presets = (mode === "percent" ? PERCENT_PRESETS : BAHT_PRESETS.filter((b) => b * 100 <= subtotal)).map(
		(value): Discount =>
			mode === "percent" ? { kind: "percent", basisPoints: value * 100 } : { kind: "amount", amount: value * 100 }
	);

	return (
		<div className="space-y-4">
			<div>
				<p className="font-semibold text-sm">{t("discountTitle")}</p>
				<p className="numeric text-muted-foreground text-xs">{t("discountBase", { amount: formatBaht(subtotal) })}</p>
			</div>

			<div role="radiogroup" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
				{(["percent", "amount"] as const).map((m) => (
					<button
						key={m}
						type="button"
						role="radio"
						aria-checked={mode === m}
						onClick={() => {
							setMode(m);
							setText("");
						}}
						className={cn(
							"h-8 rounded-md font-medium text-sm transition-colors",
							mode === m ? "bg-card shadow-sm dark:bg-white/10" : "text-muted-foreground hover:text-foreground"
						)}
					>
						{m === "percent" ? t("discountPercent") : t("discountAmount")}
					</button>
				))}
			</div>

			{/* One tap covers most discounts at a counter. */}
			<div className="grid grid-cols-5 gap-1.5">
				{presets.map((preset) => (
					<button
						key={describe(preset)}
						type="button"
						onClick={() => apply(preset)}
						className="surface surface-hover numeric h-10 rounded-lg font-medium text-sm hover:text-primary"
					>
						{describe(preset)}
					</button>
				))}
			</div>

			<div className="space-y-1.5">
				<label htmlFor="discount-custom" className="block text-muted-foreground text-xs">
					{t("discountCustom")}
				</label>
				<div className="relative">
					<input
						maxLength={10}
						id="discount-custom"
						inputMode="decimal"
						// biome-ignore lint/a11y/noAutofocus: the editor opens for exactly this input
						autoFocus
						value={text}
						onChange={(event) => setText(event.target.value.replace(/[^\d.]/g, ""))}
						onKeyDown={(event) => {
							if (event.key === "Enter" && parsed && "discount" in parsed) apply(parsed.discount);
						}}
						placeholder="0"
						className="numeric h-12 w-full rounded-lg border bg-card pr-10 pl-3 text-right font-semibold text-lg outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
					/>
					<span className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-3 text-muted-foreground">
						{mode === "percent" ? "%" : "฿"}
					</span>
				</div>
				<p
					className={cn(
						"numeric min-h-4 text-xs",
						parsed && "error" in parsed ? "text-danger" : "text-muted-foreground"
					)}
				>
					{parsed && "error" in parsed
						? t(parsed.error as "discountInvalid")
						: preview !== null
							? t("discountPreview", { off: formatBaht(preview), after: formatBaht(subtotal - preview) })
							: null}
				</p>
			</div>

			<div className="flex gap-2">
				{current ? (
					<Button
						variant="ghost"
						className="text-danger hover:text-danger"
						onClick={() => {
							setDiscount(null);
							onDone();
						}}
					>
						{t("clearDiscount")}
					</Button>
				) : null}
				<Button
					className="brand-gradient ml-auto flex-1"
					disabled={!parsed || !("discount" in parsed)}
					onClick={() => parsed && "discount" in parsed && apply(parsed.discount)}
				>
					{preview !== null ? t("applyDiscount", { amount: formatBaht(preview) }) : t("apply")}
				</Button>
			</div>
		</div>
	);
}

/**
 * The discount row of the cart summary.
 *
 * Without a discount it is a visible action — "+ ส่วนลด" in the brand colour with a dashed
 * outline, so it reads as something to press, not a label. With one it becomes a chip that
 * says what was given ("ส่วนลด 10%"), the amount it takes off, an edit and a remove.
 */
export function DiscountControl({ subtotal, off }: { subtotal: Satang; off: Satang }) {
	const t = useTranslations("pos");
	const discount = useCartStore((state) => state.discount);
	const setDiscount = useCartStore((state) => state.setDiscount);
	const [open, setOpen] = useState(false);
	const disabled = subtotal <= 0;

	return (
		<div className="flex items-center justify-between gap-2">
			<Popover open={open} onOpenChange={setOpen}>
				{discount ? (
					<div className="flex items-center gap-1">
						<PopoverTrigger asChild>
							<button
								type="button"
								className="flex h-7 items-center gap-1.5 rounded-md bg-success/12 px-2 font-medium text-success text-xs transition-colors hover:bg-success/20"
							>
								<Tag className="size-3.5" />
								{t("discountApplied", { value: describe(discount) })}
								<Pencil className="size-3 opacity-70" />
							</button>
						</PopoverTrigger>
						<button
							type="button"
							onClick={() => setDiscount(null)}
							aria-label={t("clearDiscount")}
							className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-danger"
						>
							<X className="size-3.5" />
						</button>
					</div>
				) : (
					<PopoverTrigger asChild>
						<button
							type="button"
							disabled={disabled}
							className="flex h-7 items-center gap-1.5 rounded-md border border-primary/40 border-dashed px-2 font-medium text-primary text-xs transition-colors hover:border-primary hover:bg-primary/10 disabled:pointer-events-none disabled:opacity-40"
						>
							<Tag className="size-3.5" />
							{t("addDiscount")}
						</button>
					</PopoverTrigger>
				)}
				<PopoverContent side="top" align="start" className="w-80 p-4">
					<DiscountEditor key={String(open)} subtotal={subtotal} current={discount} onDone={() => setOpen(false)} />
				</PopoverContent>
			</Popover>
			<span className={cn("numeric text-sm", off > 0 ? "font-medium text-success" : "text-muted-foreground")}>
				{off > 0 ? formatBaht(-off) : "—"}
			</span>
		</div>
	);
}
