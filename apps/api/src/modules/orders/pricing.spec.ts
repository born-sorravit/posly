import { computeOrderTotals } from "@/modules/orders/pricing";

const lines = [
	{ unitPrice: 6000, unitCost: 1800, quantity: 1 },
	{ unitPrice: 7000, unitCost: 2200, quantity: 2 },
	{ unitPrice: 6500, unitCost: 2400, quantity: 1 },
];

describe("computeOrderTotals", () => {
	it("adds exclusive VAT on top of the discounted subtotal", () => {
		expect(computeOrderTotals(lines, 0, 700, false)).toEqual({
			subtotal: 26_500,
			discount: 0,
			vat: 1855,
			total: 28_355,
			totalCost: 8600,
		});
	});

	it("reports inclusive VAT as part of the total", () => {
		const totals = computeOrderTotals(lines, 1500, 700, true);
		expect(totals.total).toBe(25_000);
		expect(totals.vat).toBe(1636);
	});

	it("clamps a discount to the subtotal and ignores a negative one", () => {
		expect(computeOrderTotals(lines, 999_999, 0, true).total).toBe(0);
		expect(computeOrderTotals(lines, -500, 0, true).discount).toBe(0);
	});
});
