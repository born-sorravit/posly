import { ValidateBy, type ValidationOptions } from "class-validator";

/**
 * Password rules, NIST 800-63B style: a length floor and a blocklist, no composition rules.
 * The web checks the same rules while typing (packages/utils/src/password.ts); keep the two
 * in step.
 */

export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt reads only the first 72 bytes; a Thai character is 3 of them in UTF-8. */
export const PASSWORD_MAX_BYTES = 72;

export type PasswordProblem = "tooShort" | "tooLong" | "common" | "personal";

/** The passwords every guessing list tries first, lowercased. Patterns catch the rest. */
const COMMON = new Set([
	"password",
	"password1",
	"password12",
	"password123",
	"password1234",
	"passw0rd",
	"p@ssw0rd",
	"p@ssword",
	"pa$$word",
	"iloveyou",
	"iloveyou1",
	"iloveyou2",
	"loveyou1",
	"sunshine",
	"princess",
	"football",
	"baseball",
	"superman",
	"batman123",
	"starwars",
	"whatever",
	"trustno1",
	"letmein1",
	"welcome1",
	"welcome123",
	"monkey123",
	"dragon123",
	"master123",
	"shadow123",
	"michael1",
	"jennifer",
	"computer",
	"internet",
	"qwerty12",
	"qwerty123",
	"qwerty1234",
	"qwertyuiop",
	"1q2w3e4r",
	"1q2w3e4r5t",
	"q1w2e3r4",
	"q1w2e3r4t5",
	"zaq12wsx",
	"1qaz2wsx",
	"abcd1234",
	"abc12345",
	"abc123456",
	"a1b2c3d4",
	"aa123456",
	"asd12345",
	"asdf1234",
	"admin123",
	"admin1234",
	"administrator",
	"changeme",
	"default1",
	"test1234",
	"test12345",
	"user1234",
	"guest123",
	"login123",
	"secret12",
	"12341234",
	"12344321",
	"11223344",
	"11112222",
	"12121212",
	"13131313",
	"69696969",
	"88888888",
	"147258369",
	"159753456",
	"123123123",
	"123321123",
	"1234qwer",
	"qwer1234",
	"posly123",
	"posly1234",
	"pos12345",
	"shop1234",
	"cafe1234",
	"thailand",
	"thailand1",
	"bangkok1",
	"bangkok123",
	"sawasdee",
	"sawadee1",
	"kitty123",
	"hellokitty",
	"hello123",
	"hello1234",
]);

const KEYBOARD_ROWS = [
	"qwertyuiop",
	"asdfghjkl",
	"zxcvbnm",
	"1234567890",
	"0987654321",
];
const SEQUENCES = [
	"0123456789",
	"9876543210",
	"abcdefghijklmnopqrstuvwxyz",
	"zyxwvutsrqponmlkjihgfedcba",
];

const byteLength = (value: string) => Buffer.byteLength(value, "utf8");

const isPattern = (lower: string): boolean => {
	if (new Set(lower).size <= 2) return true; // 11111111, abababab
	if ([...KEYBOARD_ROWS, ...SEQUENCES].some((run) => run.includes(lower)))
		return true;
	// One short block typed twice or more: "12341234", "abcabcabc".
	for (let size = 1; size <= lower.length / 2; size++) {
		if (
			lower.length % size === 0 &&
			lower.slice(0, size).repeat(lower.length / size) === lower
		)
			return true;
	}
	return false;
};

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
	const lower = password.toLowerCase();
	// Trailing digits and symbols do not rescue a listed word: "password2024!" is still it.
	const stem = lower.replace(/[\d\W_]+$/, "");
	if (COMMON.has(lower) || COMMON.has(stem) || isPattern(lower)) return "common";
	if (personalTokens(context).some((token) => lower.includes(token)))
		return "personal";
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
	const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z\d]/].filter((re) =>
		re.test(password)
	).length;
	let score = 0;
	if (length >= 12) score++;
	if (length >= 16) score++;
	if (kinds >= 2) score++;
	if (kinds >= 3) score++;
	if (new Set(password).size < 5) score = Math.min(score, 1);
	return score >= 3 ? 3 : score === 2 ? 2 : 1;
};

export const PASSWORD_MESSAGES: Record<PasswordProblem, string> = {
	tooShort: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
	tooLong: `Password must be at most ${PASSWORD_MAX_BYTES} bytes`,
	common: "Password is too common",
	personal: "Password must not contain your name or email",
};

/**
 * A new password `passwordProblem` accepts. Reads `email` and `name` from the same DTO when it
 * has them (registration); elsewhere the service checks against the stored account.
 */
export const IsAcceptablePassword = (options?: ValidationOptions) =>
	ValidateBy(
		{
			name: "isAcceptablePassword",
			validator: {
				validate: (value, args) => {
					if (typeof value !== "string") return false;
					const dto = (args?.object ?? {}) as { email?: unknown; name?: unknown };
					return (
						passwordProblem(value, {
							email: typeof dto.email === "string" ? dto.email : undefined,
							name: typeof dto.name === "string" ? dto.name : undefined,
						}) === null
					);
				},
				defaultMessage: (args) => {
					const dto = (args?.object ?? {}) as { email?: unknown; name?: unknown };
					const problem = passwordProblem(String(args?.value ?? ""), {
						email: typeof dto.email === "string" ? dto.email : undefined,
						name: typeof dto.name === "string" ? dto.name : undefined,
					});
					return problem ? PASSWORD_MESSAGES[problem] : "Password is not acceptable";
				},
			},
		},
		options
	);
