import { Money, type Satang } from "@/shared/utils/money.util";

export interface PricedLine {
	unitPrice: Satang;
	unitCost: Satang;
	quantity: number;
}

export interface OrderTotals {
	subtotal: Satang;
	discount: Satang;
	vat: Satang;
	total: Satang;
	totalCost: Satang;
}

/**
 * The one place an order's money is computed. Pure, so it is unit-tested directly and the
 * frontend's `computeTotals` can be checked against the same cases.
 *
 * `pricesIncludeVat` true: VAT is the part of the total the tax office is owed (Thai retail
 * norm). False: VAT is added on top of the discounted subtotal.
 */
export const computeOrderTotals = (
	lines: PricedLine[],
	requestedDiscount: Satang,
	vatBasisPoints: number,
	pricesIncludeVat: boolean
): OrderTotals => {
	const subtotal = Money.add(
		...lines.map((l) => Money.multiply(l.unitPrice, l.quantity))
	);
	const totalCost = Money.add(
		...lines.map((l) => Money.multiply(l.unitCost, l.quantity))
	);
	const discount = Math.min(Math.max(0, requestedDiscount), subtotal);
	const taxable = Money.subtract(subtotal, discount);

	const vat = pricesIncludeVat
		? Money.includedTax(taxable, vatBasisPoints)
		: Money.percentage(taxable, vatBasisPoints);

	return {
		subtotal,
		discount,
		vat,
		total: pricesIncludeVat ? taxable : Money.add(taxable, vat),
		totalCost,
	};
};

/**
 * Spreads an order discount over its lines in proportion to each line's amount, so a
 * line's profit is what it actually earned. Largest-remainder rounding: the shares are whole
 * satang and always add up to exactly `discount`.
 */
export const allocateDiscount = (
	lineAmounts: Satang[],
	discount: Satang
): Satang[] => {
	const total = lineAmounts.reduce((sum, a) => sum + a, 0);
	if (discount <= 0 || total <= 0) return lineAmounts.map(() => 0);
	const exact = lineAmounts.map((a) => (a * discount) / total);
	const shares = exact.map(Math.floor);
	let left = discount - shares.reduce((sum, s) => sum + s, 0);
	const byRemainder = exact
		.map((e, i) => ({ i, rest: e - shares[i] }))
		.sort((a, b) => b.rest - a.rest || a.i - b.i);
	for (const { i } of byRemainder) {
		if (left <= 0) break;
		shares[i] += 1;
		left -= 1;
	}
	return shares;
};
