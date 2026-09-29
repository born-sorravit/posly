"use client";

import { Button } from "@posly/ui/components/button";
import { Input } from "@posly/ui/components/input";
import { Label } from "@posly/ui/components/label";
import { Link } from "@/i18n/navigation";
import { BackendError } from "@/lib/api/backend";
import { api } from "@/lib/api/posly";
import { CheckCircle2, KeyRound, Loader2, MailCheck, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

function Heading({ icon: Icon, title, hint }: { icon: typeof KeyRound; title: string; hint: string }) {
	return (
		<div className="space-y-3 text-center">
			<span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
				<Icon className="size-6" />
			</span>
			<h1 className="font-semibold text-2xl tracking-tight">{title}</h1>
			<p className="text-muted-foreground text-sm">{hint}</p>
		</div>
	);
}

/**
 * Step one: ask for the email. The answer is the same whether or not the account exists —
 * the API says so too — so this page cannot be used to find out who has an account.
 */
export function ForgotPasswordForm() {
	const t = useTranslations("auth");
	const tCommon = useTranslations("common");
	const [email, setEmail] = useState("");
	const [sentTo, setSentTo] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	const send = async () => {
		setPending(true);
		try {
			await api.auth.forgotPassword(email.trim());
			setSentTo(email.trim());
		} catch (error) {
			toast.error(error instanceof Error ? error.message : tCommon("error"));
		} finally {
			setPending(false);
		}
	};

	if (sentTo) {
		return (
			<div className="space-y-6">
				<Heading icon={MailCheck} title={t("sentTitle")} hint={t("sentHint", { email: sentTo })} />
				<div className="grid gap-2">
					<Button variant="outline" size="lg" className="h-11 rounded-xl" onClick={send} disabled={pending}>
						{pending ? <Loader2 className="animate-spin" /> : null}
						{t("resendLink")}
					</Button>
					<Button asChild variant="ghost" size="lg" className="h-11 rounded-xl text-muted-foreground">
						<Link href="/login">{t("backToLogin")}</Link>
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<Heading icon={KeyRound} title={t("forgotTitle")} hint={t("forgotHint")} />
			<form
				className="space-y-4"
				onSubmit={(e) => {
					e.preventDefault();
					if (!pending && email.includes("@")) void send();
				}}
			>
				<div className="space-y-1.5">
					<Label htmlFor="email">{t("email")}</Label>
					<Input
						id="email"
						type="email"
						autoComplete="email"
						// biome-ignore lint/a11y/noAutofocus: the page exists for this field
						autoFocus
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						className="h-11 rounded-xl"
					/>
				</div>
				<Button type="submit" size="lg" className="brand-gradient h-11 w-full rounded-xl" disabled={pending || !email.includes("@")}>
					{pending ? <Loader2 className="size-4 animate-spin" /> : null}
					{t("sendLink")}
				</Button>
			</form>
			<p className="text-center text-muted-foreground text-sm">
				<Link href="/login" className="font-medium text-primary hover:underline">
					{t("backToLogin")}
				</Link>
			</p>
		</div>
	);
}

/** Step two, from the emailed link: choose the new password. */
export function ResetPasswordForm({ token }: { token: string }) {
	const t = useTranslations("auth");
	const tCommon = useTranslations("common");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [state, setState] = useState<"form" | "done" | "expired">("form");
	const [pending, setPending] = useState(false);
	const tooShort = password.length > 0 && password.length < 8;
	const mismatch = confirm.length > 0 && confirm !== password;
	const valid = password.length >= 8 && confirm === password;

	const save = async () => {
		setPending(true);
		try {
			await api.auth.resetPassword(token, password);
			setState("done");
		} catch (error) {
			if (error instanceof BackendError && error.status === 410) setState("expired");
			else toast.error(error instanceof Error ? error.message : tCommon("error"));
		} finally {
			setPending(false);
		}
	};

	if (state === "done") {
		return (
			<div className="space-y-6">
				<Heading icon={CheckCircle2} title={t("resetDoneTitle")} hint={t("resetDoneHint")} />
				<Button asChild size="lg" className="brand-gradient h-11 w-full rounded-xl">
					<Link href="/login">{t("signIn")}</Link>
				</Button>
			</div>
		);
	}
	if (state === "expired") {
		return (
			<div className="space-y-6">
				<Heading icon={TriangleAlert} title={t("resetTitle")} hint={t("resetExpired")} />
				<Button asChild size="lg" className="brand-gradient h-11 w-full rounded-xl">
					<Link href="/forgot-password">{t("requestNew")}</Link>
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<Heading icon={KeyRound} title={t("resetTitle")} hint={t("resetHint")} />
			<form
				className="space-y-4"
				onSubmit={(e) => {
					e.preventDefault();
					if (valid && !pending) void save();
				}}
			>
				<div className="space-y-1.5">
					<Label htmlFor="new-password">{t("newPassword")}</Label>
					<Input
						id="new-password"
						type="password"
						autoComplete="new-password"
						// biome-ignore lint/a11y/noAutofocus: the page exists for this field
						autoFocus
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						className="h-11 rounded-xl"
					/>
					<p className={tooShort ? "text-danger text-xs" : "text-muted-foreground text-xs"}>
						{tooShort ? t("passwordTooShort") : t("passwordHint")}
					</p>
				</div>
				<div className="space-y-1.5">
					<Label htmlFor="confirm-password">{t("confirmPassword")}</Label>
					<Input
						id="confirm-password"
						type="password"
						autoComplete="new-password"
						value={confirm}
						onChange={(e) => setConfirm(e.target.value)}
						className="h-11 rounded-xl"
					/>
					{mismatch ? <p className="text-danger text-xs">{t("passwordMismatch")}</p> : null}
				</div>
				<Button type="submit" size="lg" className="brand-gradient h-11 w-full rounded-xl" disabled={!valid || pending}>
					{pending ? <Loader2 className="size-4 animate-spin" /> : null}
					{t("savePassword")}
				</Button>
			</form>
		</div>
	);
}
