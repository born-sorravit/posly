/**
 * Ingredient amounts are fractional (0.5 kg, 18 g, 1.25 ขวด), stored as `numeric(14,3)` so
 * Postgres adds and subtracts them exactly. The driver hands `numeric` back as a string.
 */
export const quantityColumnTransformer = {
	to: (value: number | null | undefined): number | null | undefined => value,
	from: (value: string | number | null): number | null =>
		value === null || value === undefined ? null : Number(value),
};

/** Three decimals, like the column — so a float sum never shows 0.30000000000000004. */
export const roundQuantity = (value: number): number =>
	Math.round(value * 1000) / 1000;
