import { describe, expect, it } from "vitest";
import { crc16, promptPayPayload } from "./promptpay";

describe("promptpay", () => {
	it("uses CRC-16/CCITT-FALSE", () => {
		expect(crc16("123456789")).toBe("29B1");
	});

	it("encodes a mobile number and a dynamic amount", () => {
		const payload = promptPayPayload("081-234-5678", 28_355);

		expect(payload.startsWith("000201010212")).toBe(true);
		expect(payload).toContain("0113006681234567");
		expect(payload).toContain("5406283.55");
		expect(payload).toContain("5303764");
		expect(payload).toContain("5802TH");
		// The trailing checksum must match everything before it.
		expect(payload.slice(-4)).toBe(crc16(payload.slice(0, -4)));
	});

	it("is static (11) when there is no amount", () => {
		expect(promptPayPayload("0812345678").slice(6, 12)).toBe("010211");
	});
});
