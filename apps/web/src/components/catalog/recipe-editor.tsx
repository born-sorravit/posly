"use client";

import { Button } from "@posly/ui/components/button";
import { Input } from "@posly/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@posly/ui/components/select";
import { useActiveBusiness } from "@/hooks/use-workspace";
import { Link } from "@/i18n/navigation";
import type { IngredientDto, RecipeDto } from "@/lib/api/posly";
import { formatBaht } from "@posly/utils/money";
import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";

/** A recipe line as typed: the amount stays a string until it is saved. */
export interface DraftRecipeLine {
	key: string;
	ingredientId: string;
	quantity: string;
}

let lineSeq = 0;
export const blankRecipeLine = (): DraftRecipeLine => ({ key: `line-${++lineSeq}`, ingredientId: "", quantity: "" });

export const toDraftLines = (recipe: RecipeDto | undefined): DraftRecipeLine[] =>
	(recipe?.lines ?? []).map((l) => ({ key: `line-${++lineSeq}`, ingredientId: l.ingredientId, quantity: String(l.quantity) }));

/** Lines worth saving: an ingredient picked and an amount above zero. */
export const filledRecipeLines = (lines: DraftRecipeLine[]) =>
	lines.flatMap((l) => {
		const quantity = Number.parseFloat(l.quantity);
		return l.ingredientId && quantity > 0 ? [{ ingredientId: l.ingredientId, quantity: Math.round(quantity * 1000) / 1000 }] : [];
	});

/** The same sum the server makes: fractional satang per line, rounded once at the end. */
export const draftRecipeCost = (lines: DraftRecipeLine[], ingredients: IngredientDto[]) => {
	const byId = new Map(ingredients.map((i) => [i.id, i]));
	return Math.round(
		filledRecipeLines(lines).reduce((sum, l) => sum + l.quantity * (byId.get(l.ingredientId)?.unitCost ?? 0), 0)
	);
};

/**
 * Edits one recipe: which ingredients, how much of each, and what that comes to. On a phone
 * each line is two rows (the ingredient, then amount and cost); from tablet up, one row.
 */
export function RecipeEditor({
	ingredients,
	lines,
	onChange,
	disabled = false,
}: {
	ingredients: IngredientDto[];
	lines: DraftRecipeLine[];
	onChange: (lines: DraftRecipeLine[]) => void;
	disabled?: boolean;
}) {
	const t = useTranslations("recipe");
	const byId = new Map(ingredients.map((i) => [i.id, i]));
	const patch = (key: string, change: Partial<DraftRecipeLine>) =>
		onChange(lines.map((l) => (l.key === key ? { ...l, ...change } : l)));
	const picked = new Set(lines.map((l) => l.ingredientId));
	// The ingredients page sits under stock; a member without stock rights is not sent there.
	const canOpenIngredients = useActiveBusiness().can("inventory:write");

	if (ingredients.length === 0) {
		return (
			<p className="rounded-xl bg-muted/50 px-4 py-5 text-center text-muted-foreground text-sm">
				{t("noIngredients")}
				{canOpenIngredients ? (
					<>
						{" "}
						<Link href="/inventory/ingredients" className="font-medium text-primary hover:underline">
							{t("addIngredients")}
						</Link>
					</>
				) : null}
			</p>
		);
	}

	return (
		<div className="space-y-3">
			{lines.length ? (
				<ul className="grid gap-2">
					{lines.map((line) => {
						const ingredient = byId.get(line.ingredientId);
						const quantity = Number.parseFloat(line.quantity) || 0;
						const cost = ingredient ? Math.round(quantity * (ingredient.unitCost ?? 0)) : 0;
						return (
							<li
								key={line.key}
								className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-xl bg-muted/50 p-2.5 tablet:grid-cols-[1fr_8rem_5.5rem_auto] tablet:bg-transparent tablet:p-0"
							>
								<Select
									value={line.ingredientId}
									onValueChange={(ingredientId) => patch(line.key, { ingredientId })}
									disabled={disabled}
								>
									<SelectTrigger aria-label={t("ingredient")} className="col-span-3 h-10 w-full rounded-lg data-[size=default]:h-10 tablet:col-span-1">
										<SelectValue placeholder={t("pick")} />
									</SelectTrigger>
									<SelectContent>
										{ingredients.map((i) => (
											<SelectItem key={i.id} value={i.id} disabled={picked.has(i.id) && i.id !== line.ingredientId}>
												{i.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<div className="relative">
									<Input
										aria-label={t("quantity")}
										inputMode="decimal"
										maxLength={10}
										placeholder="0"
										value={line.quantity}
										disabled={disabled}
										onChange={(e) => patch(line.key, { quantity: e.target.value.replace(/[^\d.]/g, "") })}
										className="numeric h-10 rounded-lg pr-14 text-right"
									/>
									<span className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-3 max-w-12 truncate text-muted-foreground text-xs">
										{ingredient?.unit}
									</span>
								</div>
								<span className="numeric text-right text-muted-foreground text-sm">{formatBaht(cost)}</span>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									aria-label={t("remove")}
									disabled={disabled}
									onClick={() => onChange(lines.filter((l) => l.key !== line.key))}
									className="text-muted-foreground hover:text-danger"
								>
									<X />
								</Button>
							</li>
						);
					})}
				</ul>
			) : null}
			<div className="flex items-center justify-between gap-3">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="text-primary"
					disabled={disabled || lines.length >= 40}
					onClick={() => onChange([...lines, blankRecipeLine()])}
				>
					<Plus />
					{t("addLine")}
				</Button>
				<p className="text-sm">
					<span className="text-muted-foreground">{t("total")} </span>
					<span className="numeric font-semibold">{formatBaht(draftRecipeCost(lines, ingredients))}</span>
				</p>
			</div>
		</div>
	);
}
