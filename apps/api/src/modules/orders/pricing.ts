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
