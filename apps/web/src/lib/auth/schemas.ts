import { passwordProblem } from "@posly/utils/password";
import { z } from "zod";

/** Mirrors the API's `RegisterDto` / `LoginDto`, so the form rejects what the server would. */
export const loginSchema = z.object({
	email: z.email(),
	password: z.string().min(1),
});

export const registerSchema = z
	.object({
		name: z.string().trim().min(1).max(120),
		email: z.email().max(255),
		password: z.string(),
	})
	// The API applies the same rules; checking here is what puts the error under the field
	// instead of in a toast after a round trip. The message is the problem code, which the
	// form turns into Thai.
	.superRefine((values, ctx) => {
		const problem = passwordProblem(values.password, { email: values.email, name: values.name });
		if (problem) ctx.addIssue({ code: "custom", path: ["password"], message: problem });
	});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
