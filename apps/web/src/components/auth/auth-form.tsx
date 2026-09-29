"use client";

import { GoogleButton } from "@/components/auth/google-button";
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

	/** Shared by the form and the Google button: both post to a route handler that sets cookies. */
	const signIn = async (path: string, body: unknown) => {
		setServerError(null);

		const response = await fetch(`/api/auth/${path}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
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
	};

	const onSubmit = handleSubmit((values) => signIn(mode, values));

	const [googlePending, setGooglePending] = useState(false);
	const onGoogle = async (idToken: string) => {
		setGooglePending(true);
		await signIn("google", { idToken });
		setGooglePending(false);
	};

	const fieldError = (field: string) =>
		(errors as Record<string, { message?: string } | undefined>)[field]?.message;

	return (
		<div className="space-y-5">
			<div className="relative">
				<GoogleButton mode={mode} label={t("google")} onCredential={onGoogle} />
				{googlePending ? (
					<div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
						<Loader2 className="size-4 animate-spin text-primary" />
					</div>
				) : null}
			</div>

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
