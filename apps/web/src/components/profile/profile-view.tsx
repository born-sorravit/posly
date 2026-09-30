"use client";

import { PasswordInput, PasswordStrength, passwordErrorKey } from "@/components/auth/password-input";
import { PageContainer, PageHeader, SectionTitle, Surface } from "@/components/common/primitives";
import { UserAvatar } from "@/components/layout/user-menu";
import { PinRowSkeleton } from "@/components/profile/profile-skeletons";
import { SetPinDialog, SwitchVisibilityToggle } from "@/components/pin/switch-user";
import { useSession } from "@/components/providers/session-provider";
import { useRoster } from "@/hooks/use-posly";
import { useActiveBusiness } from "@/hooks/use-workspace";
import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/navigation";
import { friendlyMessage } from "@/lib/api/backend";
import { api } from "@/lib/api/posly";
import { Alert, AlertDescription } from "@posly/ui/components/alert";
import { Button } from "@posly/ui/components/button";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@posly/ui/components/input";
import { Label } from "@posly/ui/components/label";
import { PASSWORD_MAX_BYTES, passwordProblem } from "@posly/utils/password";
import { FlaskConical, KeyRound, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: ReactNode; children: ReactNode }) {
	return (
		<div className="space-y-1.5">
			<Label htmlFor={htmlFor}>{label}</Label>
			{children}
			{hint}
		</div>
	);
}

/**
 * The signed-in person's own account (not the shop's): name, sign-in email, password. The
 * same account is used in every shop they belong to, so nothing here depends on the shop.
 */
export function ProfileView() {
	const t = useTranslations("profile");
	const { user } = useSession();
	if (!user) return null;
	const demo = user.isDemo === true;

	return (
		<PageContainer className="max-w-3xl">
			<PageHeader title={t("title")} description={t("description")} />
			{demo ? <DemoNotice /> : null}
			<DetailsSection key={user.name} disabled={demo} />
			<PinSection disabled={demo} />
			{user.provider === "GOOGLE" ? (
				<Surface className="space-y-2">
					<SectionTitle className="mb-0">{t("password.title")}</SectionTitle>
					<p className="text-muted-foreground text-sm">{t("password.google")}</p>
				</Surface>
			) : (
				<PasswordSection disabled={demo} />
			)}
		</PageContainer>
	);
}

/**
 * The quick-switch PIN for the shop that is open: per shop, unlike the rest of this page, so it
 * says which shop. Setting it still happens in the PIN dialog; showing yourself on the switch
 * screen is a switch here, applied at once.
 */
function PinSection({ disabled }: { disabled: boolean }) {
	const t = useTranslations("profile.pin");
	const { business } = useActiveBusiness();
	const roster = useRoster();
	const me = roster.data?.find((p) => p.isYou);
	const hasPin = me?.hasPin ?? false;
	const [editing, setEditing] = useState(false);

	return (
		<Surface className="space-y-5">
			<div className="space-y-1">
				<SectionTitle className="mb-0">{t("title")}</SectionTitle>
				<p className="text-muted-foreground text-sm">{t("hint", { shop: business.name })}</p>
			</div>
			{/* Until the roster lands the row would say "not set" for everyone. */}
			{roster.isPending ? (
				<PinRowSkeleton />
			) : (
				<div className="flex items-center gap-4 rounded-xl bg-muted/50 p-4">
					<span
						className={cn(
							"flex size-10 shrink-0 items-center justify-center rounded-full",
							hasPin ? "bg-success/12 text-success" : "bg-muted text-muted-foreground"
						)}
					>
						<KeyRound className="size-5" />
					</span>
					<div className="min-w-0 flex-1">
						<p className="font-medium text-sm">{hasPin ? t("set") : t("notSet")}</p>
						<p className="text-muted-foreground text-xs">{hasPin ? t("setHint") : t("notSetHint")}</p>
					</div>
					<Button variant="outline" disabled={disabled || !me} onClick={() => setEditing(true)} className="shrink-0">
						{hasPin ? t("change") : t("create")}
					</Button>
				</div>
			)}
			{hasPin ? (
				<div className="border-t pt-5">
					<SwitchVisibilityToggle disabled={disabled} />
				</div>
			) : null}
			<SetPinDialog open={editing} onOpenChange={setEditing} hasPin={hasPin} />
		</Surface>
	);
}

/** Why every field below is locked, and the way out: sign up for a real account. */
function DemoNotice() {
	const t = useTranslations("profile");
	const { signOut } = useSession();
	const router = useRouter();
	const queryClient = useQueryClient();
	return (
		<div className="flex flex-col gap-4 rounded-2xl border border-primary/40 bg-primary/10 p-4 tablet:flex-row tablet:items-center tablet:p-5">
			<span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/30">
				<FlaskConical className="size-5" />
			</span>
			<div className="min-w-0 flex-1">
				<p className="font-semibold">{t("demoTitle")}</p>
				<p className="mt-0.5 text-muted-foreground text-sm">{t("demoNotice")}</p>
			</div>
			<Button
				className="brand-gradient shrink-0"
				onClick={async () => {
					await signOut();
					queryClient.clear();
					router.push("/register");
					router.refresh();
				}}
			>
				{t("demoSignup")}
			</Button>
		</div>
	);
}

function DetailsSection({ disabled }: { disabled: boolean }) {
	const t = useTranslations("profile");
	const tCommon = useTranslations("common");
	const { user, reload } = useSession();
	const [name, setName] = useState(user?.name ?? "");
	const [pending, setPending] = useState(false);
	if (!user) return null;

	const trimmed = name.trim();
	const changed = trimmed !== user.name;

	const save = async () => {
		setPending(true);
		try {
			await api.auth.updateProfile({ name: trimmed });
			await reload();
			toast.success(tCommon("saved"));
		} catch (error) {
			toast.error(error instanceof Error ? error.message : tCommon("error"));
		} finally {
			setPending(false);
		}
	};

	return (
		<Surface className="p-0">
			{/* Who this is, as a header strip: the fields below are how to change it. */}
			<div className="flex items-center gap-4 border-b px-5 py-4">
				<UserAvatar name={trimmed || user.name} className="size-14 text-xl" />
				<div className="min-w-0">
					<h2 className="truncate font-semibold text-lg leading-tight">{trimmed || user.name}</h2>
					<p className="mt-1 truncate text-muted-foreground text-sm">
						{user.provider === "GOOGLE" ? t("details.viaGoogle") : t("details.viaPassword")}
					</p>
				</div>
			</div>
			<form
				className="space-y-4 p-5"
				onSubmit={(e) => {
					e.preventDefault();
					if (changed && trimmed && !pending) void save();
				}}
			>
				<div className="grid gap-4 tablet:grid-cols-2">
					<Field
						label={t("details.name")}
						htmlFor="p-name"
						hint={trimmed ? null : <p className="text-danger text-xs">{t("details.nameRequired")}</p>}
					>
						<Input
							id="p-name"
							maxLength={120}
							autoComplete="name"
							value={name}
							disabled={disabled}
							onChange={(e) => setName(e.target.value)}
							className="h-11 rounded-xl"
						/>
					</Field>
					<Field
						label={t("details.email")}
						htmlFor="p-email"
						hint={<p className="text-muted-foreground text-xs">{t("details.emailHint")}</p>}
					>
						<Input id="p-email" value={user.email} readOnly disabled className="h-11 rounded-xl" />
					</Field>
				</div>
				<div className="flex justify-end">
					<Button type="submit" size="lg" className="brand-gradient h-11 w-full min-w-28 tablet:h-9 tablet:w-auto" disabled={disabled || !changed || !trimmed || pending}>
						{pending ? <Loader2 className="size-4 animate-spin" /> : null}
						{tCommon("save")}
					</Button>
				</div>
			</form>
		</Surface>
	);
}

function PasswordSection({ disabled }: { disabled: boolean }) {
	const t = useTranslations("profile.password");
	const tAuth = useTranslations("auth");
	const { user } = useSession();
	const [current, setCurrent] = useState("");
	const [next, setNext] = useState("");
	const [confirm, setConfirm] = useState("");
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const context = { email: user?.email, name: user?.name };
	const problem = next ? passwordProblem(next, context) : null;
	const mismatch = confirm.length > 0 && confirm !== next;
	const valid = current.length > 0 && next.length > 0 && !problem && confirm === next;

	const save = async () => {
		setPending(true);
		setError(null);
		const response = await fetch("/api/auth/change-password", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ currentPassword: current, newPassword: next }),
		}).catch(() => null);
		setPending(false);

		if (!response?.ok) {
			const payload = (await response?.json().catch(() => null)) as { message?: string } | null;
			setError(response ? friendlyMessage(response.status, payload?.message) : tAuth("unreachable"));
			return;
		}
		// The route handler stored this browser's new session; every other one is revoked.
		setCurrent("");
		setNext("");
		setConfirm("");
		toast.success(t("changed"));
	};

	return (
		<Surface className="space-y-5">
			<div className="space-y-1">
				<SectionTitle className="mb-0">{t("title")}</SectionTitle>
				<p className="text-muted-foreground text-sm">{t("hint")}</p>
			</div>
			<form
				className="space-y-4"
				onSubmit={(e) => {
					e.preventDefault();
					if (valid && !pending) void save();
				}}
			>
				{error ? (
					<Alert variant="destructive">
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				) : null}
				{/* For password managers: which account this new password belongs to. */}
				<input type="email" autoComplete="username" value={user?.email ?? ""} readOnly hidden />
				<Field label={t("current")} htmlFor="p-current">
					<PasswordInput
						id="p-current"
						maxLength={128}
						autoComplete="current-password"
						value={current}
						disabled={disabled}
						onChange={(e) => setCurrent(e.target.value)}
						className="h-11 rounded-xl"
					/>
				</Field>
				<div className="grid gap-4 tablet:grid-cols-2">
					<Field
						label={t("new")}
						htmlFor="p-new"
						hint={
							<>
								<PasswordStrength password={next} email={user?.email} name={user?.name} />
								{problem && (problem !== "tooShort" || next.length >= 4) ? (
									<p className="text-danger text-xs">{tAuth(passwordErrorKey(problem))}</p>
								) : (
									<p className="text-muted-foreground text-xs">{tAuth("passwordHint")}</p>
								)}
							</>
						}
					>
						<PasswordInput
							id="p-new"
							maxLength={PASSWORD_MAX_BYTES}
							autoComplete="new-password"
							value={next}
							disabled={disabled}
							onChange={(e) => setNext(e.target.value)}
							className="h-11 rounded-xl"
						/>
					</Field>
					<Field
						label={t("confirm")}
						htmlFor="p-confirm"
						hint={mismatch ? <p className="text-danger text-xs">{tAuth("passwordMismatch")}</p> : null}
					>
						<PasswordInput
							id="p-confirm"
							maxLength={PASSWORD_MAX_BYTES}
							autoComplete="new-password"
							value={confirm}
							disabled={disabled}
							onChange={(e) => setConfirm(e.target.value)}
							className="h-11 rounded-xl"
						/>
					</Field>
				</div>
				<div className="flex justify-end">
					<Button type="submit" size="lg" className="brand-gradient h-11 w-full min-w-28 tablet:h-9 tablet:w-auto" disabled={disabled || !valid || pending}>
						{pending ? <Loader2 className="size-4 animate-spin" /> : null}
						{t("save")}
					</Button>
				</div>
			</form>
		</Surface>
	);
}
