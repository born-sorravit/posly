/**
 * Money on the client, mirroring the API: an integer number of satang, never a float.
 *
 * Arithmetic happens here on integers; conversion to baht exists only for display and for
 * reading a typed amount out of an input. Anything that sums, discounts or taxes goes
 * through these helpers so a cart and the receipt the API prints can never disagree.
 */
export type Satang = number;

export const MINOR_UNITS = 100;

const assertSafe = (value: number): number => {
	if (!Number.isSafeInteger(value)) {
		throw new RangeError(`Expected an integer amount in satang, got ${value}`);
	}
	return value;
};

/** ฿12.50 -> 1250, rounding half away from zero. For reading a typed value only. */
export const fromBaht = (baht: number): Satang => {
	const sign = baht < 0 ? -1 : 1;
	return assertSafe(sign * Math.round(Math.abs(baht) * MINOR_UNITS));
};

export const sum = (...amounts: Satang[]): Satang =>
	assertSafe(amounts.reduce((total, amount) => total + assertSafe(amount), 0));

export const multiply = (amount: Satang, quantity: number): Satang => {
	if (!Number.isInteger(quantity)) throw new RangeError("Quantity must be a whole number");
	return assertSafe(assertSafe(amount) * quantity);
};

/** VAT added on top of an exclusive price, in basis points (700 = 7%). */
export const addedTax = (amount: Satang, basisPoints: number): Satang =>
	Math.round((assertSafe(amount) * basisPoints) / 10_000);

/** VAT already inside an inclusive price. 7% of ฿107 inclusive is ฿7. */
export const includedTax = (total: Satang, basisPoints: number): Satang =>
	Math.round((assertSafe(total) * basisPoints) / (10_000 + basisPoints));

const formatters = new Map<string, Intl.NumberFormat>();

const formatter = (fractionDigits: number): Intl.NumberFormat => {
	const key = String(fractionDigits);
	let cached = formatters.get(key);
	if (!cached) {
		cached = new Intl.NumberFormat("th-TH", {
			minimumFractionDigits: fractionDigits,
			maximumFractionDigits: fractionDigits,
		});
		formatters.set(key, cached);
	}
	return cached;
};

/**
 * 1245000 -> "฿12,450"; 28355 -> "฿283.55".
 *
 * Whole-baht amounts drop the ".00" — a menu reading ฿60.00 looks like an invoice — but a
 * fractional amount always shows both digits so ฿283.5 never appears.
 */
export const formatBaht = (
	amount: Satang,
	options: { alwaysDecimals?: boolean; signed?: boolean } = {}
): string => {
	const value = assertSafe(amount);
	const whole = value % MINOR_UNITS === 0;
	const digits = options.alwaysDecimals || !whole ? 2 : 0;
	const text = formatter(digits).format(Math.abs(value) / MINOR_UNITS);
	const sign = value < 0 ? "-" : options.signed && value > 0 ? "+" : "";
	return `${sign}฿${text}`;
};

/**
 * Quick cash amounts for a total, as the checkout offers them: the exact amount, then the
 * next round figures a customer is likely to hand over.
 */
export const quickCashAmounts = (total: Satang): Satang[] => {
	// ฿20, ฿50, ฿100, ฿500, ฿1,000 notes, in satang.
	const notes = [2000, 5000, 10_000, 50_000, 100_000];
	const candidates = new Set<Satang>([total]);

	// Rounded up to the next ฿10, ฿50 and ฿100.
	for (const step of [1000, 5000, 10_000]) {
		candidates.add(Math.ceil(total / step) * step);
	}
	for (const note of notes) {
		if (note > total) candidates.add(note);
	}

	return [...candidates]
		.filter((amount) => amount >= total)
		.sort((a, b) => a - b)
		.slice(0, 4);
};
