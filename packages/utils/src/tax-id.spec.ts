import { formatTaxId, isThaiTaxId } from "./tax-id";
import { describe, expect, it } from "vitest";

describe("isThaiTaxId", () => {
	it("accepts correct check digits", () => {
		expect(isThaiTaxId("1234567890121")).toBe(true);
		expect(isThaiTaxId("0105558012349")).toBe(true);
	});

	it("rejects a wrong check digit or length", () => {
		expect(isThaiTaxId("1234567890122")).toBe(false);
		expect(isThaiTaxId("123456789012")).toBe(false);
	});
});

describe("formatTaxId", () => {
	it("groups as on an id card, also while partly typed", () => {
		expect(formatTaxId("1234567890121")).toBe("1-2345-67890-12-1");
		expect(formatTaxId("12345")).toBe("1-2345");
		expect(formatTaxId("")).toBe("");
	});
});
