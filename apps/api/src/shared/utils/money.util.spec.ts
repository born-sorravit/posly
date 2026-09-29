import { Money, moneyColumnTransformer } from "@/shared/utils/money.util";

describe("Money", () => {
	it("converts baht to satang without float drift", () => {
		expect(Money.fromMajor(0.1 + 0.2)).toBe(30);
		expect(Money.fromMajor(19.99)).toBe(1999);
		expect(Money.fromMajor(-12.345)).toBe(-1235);
	});

	it("sums, subtracts and multiplies in integers", () => {
		expect(Money.add(6000, 7000, 1500)).toBe(14_500);
		expect(Money.subtract(28_000, 50_000)).toBe(-22_000);
		expect(Money.multiply(6000, 3)).toBe(18_000);
	});

	it("rejects fractional quantities and unsafe amounts", () => {
		expect(() => Money.multiply(6000, 1.5)).toThrow(RangeError);
		expect(() => Money.add(0.5)).toThrow(RangeError);
	});

	it("computes 7% VAT exclusive and inclusive", () => {
		expect(Money.percentage(26_500, 700)).toBe(1855);
		expect(Money.includedTax(10_700, 700)).toBe(700);
	});
});

describe("moneyColumnTransformer", () => {
	it("turns the string node-postgres returns for BIGINT into a number", () => {
		expect(moneyColumnTransformer.from("28355")).toBe(28_355);
		expect(moneyColumnTransformer.from(null)).toBeNull();
	});
});
