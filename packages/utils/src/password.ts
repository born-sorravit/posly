/**
 * Password rules, NIST 800-63B style: a length floor and no composition rules. The only
 * refused shape is a run of consecutive digits.
 * "Must contain a symbol" produces `Password1!`, not strength. The API applies the same rules
 * (apps/api/src/shared/utils/password.util.ts); keep the two in step.
 */

export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt reads only the first 72 bytes; a Thai character is 3 of them in UTF-8. */
export const PASSWORD_MAX_BYTES = 72;

export type PasswordProblem = "tooShort" | "tooLong" | "sequence" | "personal";

const DIGITS_UP = "01234567890123456789";
const DIGITS_DOWN = "98765432109876543210";

/** "12345678", "87654321", "90123456": the whole password is consecutive digits. */
const isDigitRun = (password: string): boolean =>
	/^\d+$/.test(password) && (DIGITS_UP.includes(password) || DIGITS_DOWN.includes(password));

const byteLength = (value: string) => new TextEncoder().encode(value).length;

/** Pieces of who you are that do not belong in your password: the email's name part, name words. */
const personalTokens = (context: { email?: string; name?: string }): string[] => {
	const local = context.email?.split("@")[0] ?? "";
	const words = (context.name ?? "").split(/\s+/);
	return [local, ...local.split(/[._+-]/), ...words]
		.map((token) => token.toLowerCase())
		.filter((token) => token.length >= 4);
};

/** The first rule a new password breaks, or null when it is acceptable. */
export const passwordProblem = (
	password: string,
	context: { email?: string; name?: string } = {}
): PasswordProblem | null => {
	if ([...password].length < PASSWORD_MIN_LENGTH) return "tooShort";
	if (byteLength(password) > PASSWORD_MAX_BYTES) return "tooLong";
	if (isDigitRun(password)) return "sequence";
	const lower = password.toLowerCase();
	if (personalTokens(context).some((token) => lower.includes(token))) return "personal";
	return null;
};

/**
 * 0 unacceptable · 1 weak · 2 fair · 3 strong. Advice for the meter only; anything that passes
 * `passwordProblem` may be saved.
 */
export const passwordStrength = (
	password: string,
	context: { email?: string; name?: string } = {}
): 0 | 1 | 2 | 3 => {
	if (passwordProblem(password, context)) return 0;
	const length = [...password].length;
	const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z\d]/].filter((re) => re.test(password)).length;
	let score = 0;
	if (length >= 12) score++;
	if (length >= 16) score++;
	if (kinds >= 2) score++;
	if (kinds >= 3) score++;
	if (new Set(password).size < 5) score = Math.min(score, 1);
	return score >= 3 ? 3 : score === 2 ? 2 : 1;
};
