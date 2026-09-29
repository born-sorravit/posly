import { describe, expect, it } from "vitest";
import { formatPercent, nameColorIndex, nameInitial } from "./format";

describe("formatPercent", () => {
	it("keeps one decimal below 100%", () => {
		expect(formatPercent(0.142)).toBe("14.2%");
		expect(formatPercent(0.018)).toBe("1.8%");
		expect(formatPercent(0)).toBe("0.0%");
	});

	it("drops the decimal and groups thousands from 100% up", () => {
		expect(formatPercent(1)).toBe("100%");
		expect(formatPercent(25.556)).toBe("2,556%");
		expect(formatPercent(250.08)).toBe("25,008%");
	});

	it("is unsigned", () => {
		expect(formatPercent(-0.25)).toBe("25.0%");
		expect(formatPercent(-12.345)).toBe("1,235%");
	});

	it("picks the format after rounding, so 99.96% reads 100%", () => {
		expect(formatPercent(0.9996)).toBe("100%");
		expect(formatPercent(0.9994)).toBe("99.9%");
	});
});

describe("nameInitial", () => {
	it.each([
		["คุณแนน", "น"],
		["แนน", "น"],
		["ไก่", "ก"],
		["เจ๊หมวย", "จ"],
		["มายด์", "ม"],
		["  somchai ", "S"],
		["Sunny Cafe", "S"],
		["คุณ", "ค"],
		["", "?"],
	])("%s → %s", (name, initial) => expect(nameInitial(name)).toBe(initial));
});

describe("nameColorIndex", () => {
	it("is stable, in range, and ignores คุณ and spacing", () => {
		const i = nameColorIndex("คุณแนน", 8);
		expect(i).toBeGreaterThanOrEqual(0);
		expect(i).toBeLessThan(8);
		expect(nameColorIndex("คุณแนน", 8)).toBe(i);
		expect(nameColorIndex("  แนน ", 8)).toBe(i);
	});

	it("spreads a shop's names over the palette", () => {
		const names = ["คุณแนน", "ต้น", "มายด์", "บอส", "ป้าแดง", "Somchai", "Malee", "พนักงานใหม่"];
		expect(new Set(names.map((n) => nameColorIndex(n, 8))).size).toBeGreaterThanOrEqual(5);
	});
});
