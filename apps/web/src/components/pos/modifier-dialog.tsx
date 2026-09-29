"use client";

import { ProductThumb } from "@/components/common/product-thumb";
import { Button } from "@posly/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@posly/ui/components/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@posly/ui/components/sheet";
import { TABLET_UP, useMediaQuery } from "@/hooks/use-media-query";
import { formatBaht, sum } from "@posly/utils/money";
import { cn } from "@/lib/utils";
import type { ModifierGroup, OrderItemModifier, Product } from "@posly/types/domain";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

type Selection = Record<string, string[]>;

const defaults = (groups: ModifierGroup[]): Selection =>
	Object.fromEntries(
		groups.map((g) => [g.id, g.defaultOptionId ? [g.defaultOptionId] : []])
	);

function OptionPill({
	selected,
	multiple,
	label,
	delta,
	onClick,
}: {
	selected: boolean;
	multiple: boolean;
	label: string;
	delta: number;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			role={multiple ? "checkbox" : "radio"}
			aria-checked={selected}
			onClick={onClick}
			className={cn(
				"touch-target flex h-12 items-center gap-2.5 rounded-xl px-3.5 text-left text-sm ring-1 transition-colors",
				selected
					? "bg-accent font-medium text-accent-foreground ring-primary"
					: "bg-card ring-border hover:bg-muted"
			)}
		>
			<span
				className={cn(
					"flex size-5 shrink-0 items-center justify-center border-2 transition-colors",
					multiple ? "rounded-md" : "rounded-full",
					selected ? "border-primary bg-primary text-primary-foreground" : "border-border"
				)}
			>
				{selected ? <Check className="size-3" strokeWidth={3} /> : null}
			</span>
			<span className="flex-1">{label}</span>
			{delta > 0 ? (
				<span className="numeric text-muted-foreground text-xs">+{formatBaht(delta)}</span>
			) : null}
		</button>
	);
}

function ModifierBody({
	product,
	onConfirm,
}: {
	product: Product;
	onConfirm: (modifiers: OrderItemModifier[], note: string | null) => void;
}) {
	const t = useTranslations("pos");
	const [selection, setSelection] = useState<Selection>(() => defaults(product.modifierGroups));
	const [note, setNote] = useState("");

	const chosen: OrderItemModifier[] = useMemo(
		() =>
			product.modifierGroups.flatMap((group) =>
				group.options
					.filter((option) => selection[group.id]?.includes(option.id))
					.map((option) => ({
						optionId: option.id,
						groupName: group.name,
						optionName: option.name,
						priceDelta: option.priceDelta,
					}))
			),
		[product.modifierGroups, selection]
	);

	const missing = product.modifierGroups.some(
		(group) => group.required && (selection[group.id]?.length ?? 0) === 0
	);
	const price = sum(product.price, ...chosen.map((m) => m.priceDelta));

	const toggle = (group: ModifierGroup, optionId: string) =>
		setSelection((current) => {
			const picked = current[group.id] ?? [];
			if (group.selection === "SINGLE") return { ...current, [group.id]: [optionId] };
			return {
				...current,
				[group.id]: picked.includes(optionId)
					? picked.filter((id) => id !== optionId)
					: [...picked, optionId],
			};
		});

	return (
		<div className="flex max-h-[85svh] flex-col">
			<div className="flex items-center gap-4 border-b p-5">
				<ProductThumb art={product.art} imageUrl={product.imageUrl} name={product.name} className="size-16" />
				<div>
					<p className="font-semibold text-lg">{product.name}</p>
					<p className="numeric text-muted-foreground text-sm">{formatBaht(product.price)}</p>
				</div>
			</div>

			<div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
				{product.modifierGroups.map((group) => (
					<fieldset key={group.id} className="space-y-2.5">
						<legend className="mb-2.5 flex w-full items-center justify-between font-medium text-sm">
							{group.name}
							<span className="font-normal text-muted-foreground text-xs">
								{group.required ? t("required") : t("optional")}
								{group.selection === "MULTIPLE" ? ` · ${t("multiple")}` : ""}
							</span>
						</legend>
						<div className="grid grid-cols-2 gap-2 tablet:grid-cols-3">
							{group.options.map((option) => (
								<OptionPill
									key={option.id}
									multiple={group.selection === "MULTIPLE"}
									selected={selection[group.id]?.includes(option.id) ?? false}
									label={option.name}
									delta={option.priceDelta}
									onClick={() => toggle(group, option.id)}
								/>
							))}
						</div>
					</fieldset>
				))}

				<label className="block space-y-2">
					<span className="font-medium text-sm">{t("note")}</span>
					<input
						maxLength={200}
						value={note}
						onChange={(event) => setNote(event.target.value)}
						placeholder={t("notePlaceholder")}
						className="h-11 w-full rounded-xl border bg-card px-3 text-sm outline-none focus:border-primary/50 focus:ring-3 focus:ring-primary/15"
					/>
				</label>
			</div>

			<div className="border-t p-4">
				<Button
					size="lg"
					disabled={missing}
					className="brand-gradient h-13 w-full rounded-xl font-semibold text-base"
					onClick={() => onConfirm(chosen, note.trim() || null)}
				>
					{t("addFor", { price: formatBaht(price) })}
				</Button>
			</div>
		</div>
	);
}

/**
 * Size / sweetness / extras for a product that has them (plan §9, §16). A bottom sheet on a
 * phone (thumb reach), a centred modal from tablet up.
 */
export function ModifierDialog({
	product,
	onOpenChange,
	onConfirm,
}: {
	product: Product | null;
	onOpenChange: (open: boolean) => void;
	onConfirm: (product: Product, modifiers: OrderItemModifier[], note: string | null) => void;
}) {
	const t = useTranslations("pos");
	const wide = useMediaQuery(TABLET_UP);
	const open = product !== null;

	const body = product ? (
		<ModifierBody
			key={product.id}
			product={product}
			onConfirm={(modifiers, note) => onConfirm(product, modifiers, note)}
		/>
	) : null;

	if (wide) {
		return (
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-lg">
					<DialogTitle className="sr-only">{product?.name}</DialogTitle>
					<DialogDescription className="sr-only">{t("customise")}</DialogDescription>
					{body}
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="bottom" className="gap-0 rounded-t-3xl p-0">
				<SheetTitle className="sr-only">{product?.name}</SheetTitle>
				<SheetDescription className="sr-only">{t("customise")}</SheetDescription>
				{body}
			</SheetContent>
		</Sheet>
	);
}
