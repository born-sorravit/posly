import { averageCost } from "@/shared/utils/average-cost.util";

describe("averageCost", () => {
	it("weights what is on hand against what was received", () => {
		// 10 bottles at ฿20 + 30 bottles at ฿24 = ฿920 / 40 = ฿23
		expect(averageCost(10, 2000, 30, 2400)).toBe(2300);
	});

	it("takes the price paid when nothing usable is on hand", () => {
		expect(averageCost(0, 2000, 12, 2500)).toBe(2500);
		expect(averageCost(-24, 50, 1000, 52)).toBe(52);
		expect(averageCost(8, null, 12, 2500)).toBe(2500);
	});

	it("leaves the cost alone when nothing was received", () => {
		expect(averageCost(10, 2000, 0, 9999)).toBe(2000);
	});

	it("keeps fractions for the caller to round", () => {
		expect(averageCost(1, 100, 2, 101)).toBeCloseTo(100.667, 3);
	});
});
