/**
 * Thai tax id / national id: 13 digits, the last a mod-11 check digit over the first twelve
 * (weights 13…2). The API checks the same rule; checking here says so while typing.
 */
export const isThaiTaxId = (value: string): boolean => {
	if (!/^\d{13}$/.test(value)) return false;
	let sum = 0;
	for (let i = 0; i < 12; i++) sum += Number(value[i]) * (13 - i);
	return (11 - (sum % 11)) % 10 === Number(value[12]);
};

/** "1234567890121" → "1-2345-67890-12-1", the grouping printed on Thai id cards. */
export const formatTaxId = (digits: string): string =>
	[digits.slice(0, 1), digits.slice(1, 5), digits.slice(5, 10), digits.slice(10, 12), digits.slice(12, 13)]
		.filter(Boolean)
		.join("-");
