/**
 * Money is an integer count of the currency's minor unit — satang for THB — everywhere:
 * in the database (`BIGINT`), in memory and on the wire.
 *
 * Never a float. `0.1 + 0.2 !== 0.3`, and a POS that is one satang off on a refund is a
 * POS a shop owner stops trusting. Arithmetic happens on integers here; formatting into
 * baht happens only at the edge (receipts, the frontend).
 *
 * A JS `number` holds integers exactly up to 2^53 (~90 trillion baht in satang), so it is
 * used in memory instead of `bigint` — which JSON cannot serialise — and the column
 * transformer below guards the boundary.
 */
export type Satang = number;

/** Minor units per major unit. Every currency Posly targets today uses 100. */
export const MINOR_UNITS = 100;

const assertSafe = (value: number, label: string): number => {
	if (!Number.isSafeInteger(value)) {
		throw new RangeError(`${label} must be a safe integer amount, got ${value}`);
	}
	return value;
};

export const Money = {
	/** ฿12.50 -> 1250. Rounds half away from zero, so a typed price never loses a satang. */
	fromMajor(major: number): Satang {
		const sign = major < 0 ? -1 : 1;
		return assertSafe(sign * Math.round(Math.abs(major) * MINOR_UNITS), "amount");
	},

	/** 1250 -> 12.5. For display only; never feed the result back into arithmetic. */
	toMajor(amount: Satang): number {
		return assertSafe(amount, "amount") / MINOR_UNITS;
	},

	add(...amounts: Satang[]): Satang {
		return assertSafe(
			amounts.reduce((sum, amount) => sum + assertSafe(amount, "amount"), 0),
			"sum"
		);
	},

	subtract(a: Satang, b: Satang): Satang {
		return assertSafe(
			assertSafe(a, "amount") - assertSafe(b, "amount"),
			"difference"
		);
	},

	/** Unit price × quantity. Quantity is a whole number of items. */
	multiply(amount: Satang, quantity: number): Satang {
		if (!Number.isInteger(quantity)) {
			throw new RangeError(`quantity must be an integer, got ${quantity}`);
		}
		return assertSafe(assertSafe(amount, "amount") * quantity, "product");
	},

	/**
	 * A percentage of an amount, e.g. VAT or a % discount, rounded to the nearest satang.
	 * `basisPoints` avoids a float rate: 7% VAT is 700.
	 */
	percentage(amount: Satang, basisPoints: number): Satang {
		return assertSafe(
			Math.round((assertSafe(amount, "amount") * basisPoints) / 10_000),
			"percentage"
		);
	},

	/**
	 * VAT already included in a VAT-inclusive total — the common case for Thai retail
	 * prices. 7% inclusive of ฿107 is ฿7.
	 */
	includedTax(total: Satang, basisPoints: number): Satang {
		return assertSafe(
			Math.round(
				(assertSafe(total, "amount") * basisPoints) / (10_000 + basisPoints)
			),
			"tax"
		);
	},
};

/**
 * TypeORM transformer for `BIGINT` money columns.
 *
 * node-postgres returns `bigint` as a **string** (it cannot know the value fits a number),
 * and without this `a.total + b.total` concatenates: "100" + "250" = "100250". Every money
 * column goes through here so the entity always holds a number.
 */
export const moneyColumnTransformer = {
	to: (value: Satang | null | undefined): Satang | null | undefined => value,
	from: (value: string | number | null): Satang | null => {
		if (value === null || value === undefined) return null;
		const parsed = typeof value === "number" ? value : Number(value);
		return assertSafe(parsed, "stored amount");
	},
};
