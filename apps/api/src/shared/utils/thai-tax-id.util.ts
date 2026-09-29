import { ValidateBy, type ValidationOptions } from "class-validator";

/**
 * A Thai tax id / national id: 13 digits whose last is a mod-11 check digit over the first
 * twelve (weights 13…2). Catches the typo'd id before it prints on a tax invoice.
 */
export const isThaiTaxId = (value: unknown): boolean => {
	if (typeof value !== "string" || !/^\d{13}$/.test(value)) return false;
	let sum = 0;
	for (let i = 0; i < 12; i++) sum += Number(value[i]) * (13 - i);
	return (11 - (sum % 11)) % 10 === Number(value[12]);
};

export const IsThaiTaxId = (options?: ValidationOptions) =>
	ValidateBy(
		{
			name: "isThaiTaxId",
			validator: {
				validate: isThaiTaxId,
				defaultMessage: () => "taxId must be a valid 13-digit Thai tax id",
			},
		},
		options
	);
