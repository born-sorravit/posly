"use client";

import { cn } from "@/lib/utils";
import { Input } from "@posly/ui/components/input";
import { passwordStrength } from "@posly/utils/password";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ComponentProps, useState } from "react";

const PASSWORD_ERRORS = {
	tooShort: "passwordTooShort",
	tooLong: "passwordTooLong",
	common: "passwordCommon",
	personal: "passwordPersonal",
} as const;

/** The schema reports a `passwordProblem` code; anything else is the generic "too short". */
export const passwordErrorKey = (message: string | undefined) =>
	PASSWORD_ERRORS[message as keyof typeof PASSWORD_ERRORS] ?? "passwordTooShort";

/** A password field with a show/hide toggle: on a tablet keyboard, seeing the typo beats retyping. */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<typeof Input>, "type">) {
	const t = useTranslations("auth");
	const [visible, setVisible] = useState(false);
	return (
		<div className="relative">
			<Input {...props} type={visible ? "text" : "password"} className={cn("pr-11", className)} />
			<button
				type="button"
				onClick={() => setVisible((v) => !v)}
				aria-label={visible ? t("hidePassword") : t("showPassword")}
				aria-pressed={visible}
				className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground"
			>
				{visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
			</button>
		</div>
	);
}

// Every level here is a password that may be saved, so none of them is red.
const LEVELS = [
	{ key: "fair", bar: "bg-warning", text: "text-warning" },
	{ key: "good", bar: "bg-success", text: "text-success" },
	{ key: "strong", bar: "bg-success", text: "text-success" },
] as const;

/**
 * Three bars under a new password. Advice only: `passwordProblem` decides what may be saved,
 * and anything it accepts shows at least one bar.
 */
export function PasswordStrength({
	password,
	email,
	name,
}: {
	password: string;
	email?: string;
	name?: string;
}) {
	const t = useTranslations("auth.strength");
	if (!password) return null;
	const score = passwordStrength(password, { email, name });
	const level = score === 0 ? null : LEVELS[score - 1];
	return (
		<div className="flex items-center gap-2" aria-live="polite">
			<div className="flex flex-1 gap-1">
				{LEVELS.map((l, i) => (
					<span
						key={l.key}
						className={cn("h-1 flex-1 rounded-full transition-colors", level && i < score ? level.bar : "bg-border")}
					/>
				))}
			</div>
			{level ? <span className={cn("w-12 text-right text-xs", level.text)}>{t(level.key)}</span> : null}
		</div>
	);
}
