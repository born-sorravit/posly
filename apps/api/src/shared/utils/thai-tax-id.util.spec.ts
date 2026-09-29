import { isThaiTaxId } from "@/shared/utils/thai-tax-id.util";

describe("isThaiTaxId", () => {
	it("accepts a correct check digit", () => {
		expect(isThaiTaxId("1234567890121")).toBe(true);
		expect(isThaiTaxId("0105558012349")).toBe(true); // a company id
	});

	it("rejects a wrong check digit, the wrong length and non-digits", () => {
		expect(isThaiTaxId("1234567890122")).toBe(false);
		expect(isThaiTaxId("123456789012")).toBe(false);
		expect(isThaiTaxId("12345678901a1")).toBe(false);
		expect(isThaiTaxId(1_234_567_890_121)).toBe(false);
	});
});
