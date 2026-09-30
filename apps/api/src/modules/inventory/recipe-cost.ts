import type { Satang } from "@/shared/utils/money.util";

export interface CostedIngredient {
	purchasePrice: Satang;
	purchaseQty: number;
}

export interface CostedLine {
	quantity: number;
	ingredient: CostedIngredient;
}

/** What one unit of an ingredient costs, in (fractional) satang. */
export const unitCost = (ingredient: CostedIngredient): number =>
	ingredient.purchaseQty > 0 ? ingredient.purchasePrice / ingredient.purchaseQty : 0;

/**
 * A recipe's cost: Σ quantity × price per unit, rounded to whole satang once at the end —
 * rounding each line would lose up to half a satang per ingredient.
 */
export const recipeCost = (lines: CostedLine[]): Satang =>
	Math.round(lines.reduce((sum, l) => sum + l.quantity * unitCost(l.ingredient), 0));
