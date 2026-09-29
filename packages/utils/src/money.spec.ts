import { describe, expect, it } from "vitest";
import {
	addedTax,
	formatBaht,
	fromBaht,
	includedTax,
	multiply,
	quickCashAmounts,
	sum,
} from "./money";

describe("money", () => {
	it("reads typed baht into satang without float drift", () => {
		expect(fromBaht(0.1 + 0.2)).toBe(30);
		expect(fromBaht(283.55)).toBe(28_355);
	});

	it("sums and multiplies integers only", () => {
		expect(sum(6000, 7000, 7000, 6500)).toBe(26_500);
		expect(multiply(6000, 3)).toBe(18_000);
		expect(() => multiply(6000, 0.5)).toThrow(RangeError);
		expect(() => sum(0.5)).toThrow(RangeError);
	});

	it("computes 7% VAT both ways", () => {
		expect(addedTax(26_500, 700)).toBe(1855);
		expect(includedTax(10_700, 700)).toBe(700);
	});

	it("formats whole baht without decimals and fractions with two", () => {
		expect(formatBaht(1_245_000)).toBe("฿12,450");
		expect(formatBaht(28_355)).toBe("฿283.55");
		expect(formatBaht(28_350)).toBe("฿283.50");
		expect(formatBaht(-8000)).toBe("-฿80");
	});

	it("offers the exact total and the next round notes", () => {
		expect(quickCashAmounts(28_000)).toEqual([28_000, 30_000, 50_000, 100_000]);
		expect(quickCashAmounts(28_355)).toEqual([28_355, 29_000, 30_000, 50_000]);
	});
});
