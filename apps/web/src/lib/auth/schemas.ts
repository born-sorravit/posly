import { z } from "zod";

/** Mirrors the API's `RegisterDto` / `LoginDto`, so the form rejects what the server would. */
export const loginSchema = z.object({
	email: z.email(),
	password: z.string().min(1),
});

export const registerSchema = z.object({
	name: z.string().trim().min(1).max(120),
	email: z.email().max(255),
	// The API enforces the same bound; duplicating it here is what makes the error appear
	// under the field instead of as a toast after a round trip.
	password: z.string().min(8).max(128),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
