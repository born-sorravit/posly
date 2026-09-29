"use client";

import { DemoDialog } from "@/components/demo/demo-dialog";
import { useSession } from "@/components/providers/session-provider";
import { Alert, AlertDescription } from "@posly/ui/components/alert";
import { Button } from "@posly/ui/components/button";
import { Input } from "@posly/ui/components/input";
import { Label } from "@posly/ui/components/label";
import { Link, useRouter } from "@/i18n/navigation";
import {
	type LoginValues,
	type RegisterValues,
	loginSchema,
	registerSchema,
} from "@/lib/auth/schemas";
import { friendlyMessage } from "@/lib/api/backend";
import { env } from "@/lib/env";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

type Mode = "login" | "register";

function GoogleIcon() {
	return (
		<svg viewBox="0 0 24 24" className="size-4" aria-hidden>
			<path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.2-4.7 3.2-8Z" />
			<path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23Z" />
			<path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.7-2.8Z" />
			<path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4Z" />
		</svg>
	);
}

/**
 * Posts to the Next route handler, not to the API: the handler exchanges credentials for
 * tokens and writes them into httpOnly cookies, so no token is ever readable by page script.
 *
 * A new account with no shop is routed to onboarding by the app layout (plan §6).
 */
export function AuthForm({ mode }: { mode: Mode }) {
	const t = useTranslations("auth");
	const router = useRouter();
	const searchParams = useSearchParams();
	const { refresh } = useSession();
	const [serverError, setServerError] = useState<string | null>(null);

	const isRegister = mode === "register";
	const form = useForm<RegisterValues | LoginValues>({
		resolver: zodResolver(isRegister ? registerSchema : loginSchema),
		defaultValues: isRegister ? { name: "", email: "", password: "" } : { email: "", password: "" },
	});

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = form;

	const onSubmit = handleSubmit(async (values) => {
		setServerError(null);

		const response = await fetch(`/api/auth/${mode}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(values),
		}).catch(() => null);

		if (!response) {
			setServerError(t("unreachable"));
			return;
		}

		if (!response.ok) {
			const payload = (await response.json().catch(() => null)) as { message?: string } | null;
			setServerError(friendlyMessage(response.status, payload?.message));
			return;
		}

		await refresh();
		const next = searchParams.get("next");
		// The app layout decides where a new account belongs: its invited shop if any, else
		// onboarding. Sending everyone to onboarding would ask an invited cashier to open a shop.
		router.replace(next?.startsWith("/") ? next : "/dashboard");
		router.refresh();
	});

	const fieldError = (field: string) =>
		(errors as Record<string, { message?: string } | undefined>)[field]?.message;

	return (
		<div className="space-y-5">
			{/* Needs NEXT_PUBLIC_GOOGLE_CLIENT_ID + Google Identity Services; /api/auth/google is ready. */}
			<Button type="button" variant="outline" size="lg" className="h-11 w-full rounded-xl" disabled>
				<GoogleIcon />
				{t("google")}
			</Button>

			<div className="flex items-center gap-3 text-muted-foreground text-xs">
				<span className="h-px flex-1 bg-border" />
				{t("or")}
				<span className="h-px flex-1 bg-border" />
			</div>

			<form onSubmit={onSubmit} className="space-y-4" noValidate>
				{serverError ? (
					<Alert variant="destructive">
						<AlertCircle className="size-4" />
						<AlertDescription>{serverError}</AlertDescription>
					</Alert>
				) : null}

				{isRegister ? (
					<div className="space-y-1.5">
						<Label htmlFor="name">{t("name")}</Label>
						<Input id="name" autoComplete="name" className="h-11 rounded-xl" {...register("name" as "email")} />
						{fieldError("name") ? <p className="text-danger text-xs">{t("nameRequired")}</p> : null}
					</div>
				) : null}

				<div className="space-y-1.5">
					<Label htmlFor="email">{t("email")}</Label>
					<Input id="email" type="email" autoComplete="email" className="h-11 rounded-xl" {...register("email")} />
					{fieldError("email") ? <p className="text-danger text-xs">{t("emailInvalid")}</p> : null}
				</div>

				<div className="space-y-1.5">
					<div className="flex items-baseline justify-between gap-3">
						<Label htmlFor="password">{t("password")}</Label>
						{isRegister ? null : (
							<Link href="/forgot-password" className="text-primary text-xs hover:underline">
								{t("forgot")}
							</Link>
						)}
					</div>
					<Input
						id="password"
						type="password"
						autoComplete={isRegister ? "new-password" : "current-password"}
						className="h-11 rounded-xl"
						{...register("password")}
					/>
					{fieldError("password") ? (
						<p className="text-danger text-xs">
							{isRegister ? t("passwordTooShort") : t("passwordRequired")}
						</p>
					) : isRegister ? (
						<p className="text-muted-foreground text-xs">{t("passwordHint")}</p>
					) : null}
				</div>

				<Button type="submit" size="lg" className="brand-gradient h-11 w-full rounded-xl" disabled={isSubmitting}>
					{isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
					{isRegister ? t("createAccount") : t("signIn")}
				</Button>
			</form>

			<p className="text-center text-muted-foreground text-sm">
				{isRegister ? t("haveAccount") : t("noAccount")}{" "}
				<Link
					href={{
						pathname: isRegister ? "/login" : "/register",
						// An invite link sends people here with ?next=/invite/…; switching between
						// sign-in and sign-up must not lose it.
						query: searchParams.get("next") ? { next: searchParams.get("next") as string } : undefined,
					}}
					className="font-medium text-primary hover:underline"
				>
					{isRegister ? t("signIn") : t("createAccount")}
				</Link>
			</p>

			{!isRegister && env.demoEnabled ? (
				<p className="-mt-2 text-center text-muted-foreground text-sm">
					{t("tryDemo")}{" "}
					<DemoDialog>
						<button type="button" className="font-medium text-primary hover:underline">
							{t("tryDemoLink")}
						</button>
					</DemoDialog>
				</p>
			) : null}
		</div>
	);
}
