import type { Satang } from "./money";

/**
 * Thai QR Payment ("PromptPay") payload, per the EMVCo merchant-presented spec as profiled
 * by the Bank of Thailand.
 *
 * Built locally rather than by a payment gateway: phase 1 has the cashier confirm receipt
 * by hand, so all the QR needs is the shop's PromptPay id and the order amount. A dynamic QR
 * (point of initiation "12") carries the amount, so the customer cannot mistype it.
 */

const tlv = (id: string, value: string): string =>
	`${id}${value.length.toString().padStart(2, "0")}${value}`;

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), as the spec requires for tag 63. */
export const crc16 = (input: string): string => {
	let crc = 0xffff;
	for (let i = 0; i < input.length; i++) {
		crc ^= input.charCodeAt(i) << 8;
		for (let bit = 0; bit < 8; bit++) {
			crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
			crc &= 0xffff;
		}
	}
	return crc.toString(16).toUpperCase().padStart(4, "0");
};

const AID_PROMPTPAY = "A000000677010111";

/**
 * A mobile number becomes `0066` + the number without its leading zero, padded to 13
 * digits; a 13-digit national/tax id is used as-is.
 */
const formatTarget = (target: string): { tag: string; value: string } => {
	const digits = target.replace(/\D/g, "");
	if (digits.length >= 13) return { tag: "02", value: digits };
	const mobile = `66${digits.replace(/^0/, "")}`;
	return { tag: "01", value: mobile.padStart(13, "0") };
};

export const promptPayPayload = (target: string, amount?: Satang): string => {
	const { tag, value } = formatTarget(target);

	const merchant = tlv("00", AID_PROMPTPAY) + tlv(tag, value);
	const parts = [
		tlv("00", "01"),
		tlv("01", amount ? "12" : "11"),
		tlv("29", merchant),
		tlv("53", "764"),
		tlv("58", "TH"),
	];
	if (amount) {
		parts.splice(4, 0, tlv("54", (amount / 100).toFixed(2)));
	}

	// The CRC covers everything up to and including its own tag and length.
	const withoutCrc = `${parts.join("")}6304`;
	return withoutCrc + crc16(withoutCrc);
};
