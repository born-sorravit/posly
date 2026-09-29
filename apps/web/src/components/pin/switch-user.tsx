"use client";

import { StatusBadge } from "@/components/common/primitives";
import { UserAvatar } from "@/components/layout/user-menu";
import { useSession } from "@/components/providers/session-provider";
import { Button } from "@posly/ui/components/button";
import { Switch } from "@posly/ui/components/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@posly/ui/components/dialog";
import { Input } from "@posly/ui/components/input";
import { Label } from "@posly/ui/components/label";
import { usePinMutations, useRoster } from "@/hooks/use-posly";
import { DEMO_PIN } from "@/lib/demo";
import { useActiveBusiness } from "@/hooks/use-workspace";
import { formatClock } from "@posly/utils/format";
import { cn } from "@/lib/utils";
import type { RosterEntry } from "@/lib/api/posly";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Delete, FlaskConical, KeyRound, Loader2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { create } from "zustand";

export const useSwitchUser = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({
	open: false,
	setOpen: (open) => set({ open }),
}));

const PIN_MIN = 4;
const PIN_MAX = 6;

/** A phone-style keypad: big targets for a busy counter, and the keyboard works too. */
function PinPad({
	value,
	onChange,
	onSubmit,
	busy,
	error,
}: {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	busy: boolean;
	error: string | null;
}) {
	const t = useTranslations("pin");
	const press = useCallback(
		(key: string) => {
			if (busy) return;
			if (key === "back") onChange(value.slice(0, -1));
			else if (value.length < PIN_MAX) onChange(value + key);
		},
		[busy, onChange, value]
	);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (/^\d$/.test(event.key)) press(event.key);
			else if (event.key === "Backspace") press("back");
			else if (event.key === "Enter" && value.length >= PIN_MIN) onSubmit();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [press, onSubmit, value.length]);

	const ready = value.length >= PIN_MIN && !busy;
	// Round keys on a faint tint, like a phone's lock screen: big enough for a thumb at a busy
	// counter, quiet enough that the dots above stay the focus.
	const key =
		"numeric flex size-[4.5rem] items-center justify-center rounded-full text-[1.75rem] font-medium transition tablet:size-20 active:scale-95";

	return (
		<div className="flex flex-col items-center gap-5">
			<motion.div
				className="flex h-4 items-center gap-4"
				animate={error ? { x: [0, -10, 10, -6, 6, 0] } : { x: 0 }}
				transition={{ duration: 0.35 }}
				key={error ?? "ok"}
				aria-label={t("entered", { count: value.length })}
			>
				{Array.from({ length: Math.max(PIN_MIN, value.length) }, (_, i) => (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: positions, not items
						key={i}
						className={cn(
							"size-3.5 rounded-full border-2 transition-all duration-150",
							i < value.length
								? error
									? "scale-110 border-danger bg-danger"
									: "scale-110 border-primary bg-primary"
								: "border-muted-foreground/40 bg-transparent"
						)}
					/>
				))}
			</motion.div>
			<p className={cn("h-5 text-center text-sm", error ? "text-danger" : "text-muted-foreground")} role="status">
				{error ?? t("enterPin")}
			</p>
			<div className="mt-2 grid grid-cols-3 gap-x-6 gap-y-4 tablet:gap-x-7">
				{["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
					<button
						key={d}
						type="button"
						onClick={() => press(d)}
						className={cn(key, "bg-foreground/[0.06] ring-1 ring-foreground/[0.06] hover:bg-foreground/10 active:bg-foreground/15")}
					>
						{d}
					</button>
				))}
				<button
					type="button"
					onClick={() => press("back")}
					aria-label={t("backspace")}
					className={cn(
						key,
						"text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
						value.length === 0 && "pointer-events-none opacity-0"
					)}
				>
					<Delete className="size-7" />
				</button>
				<button
					type="button"
					onClick={() => press("0")}
					className={cn(key, "bg-foreground/[0.06] ring-1 ring-foreground/[0.06] hover:bg-foreground/10 active:bg-foreground/15")}
				>
					0
				</button>
				<button
					type="button"
					disabled={!ready}
					onClick={onSubmit}
					aria-label={t("ok")}
					className={cn(
						key,
						ready
							? "brand-gradient text-primary-foreground shadow-lg shadow-primary/30"
							: "text-muted-foreground/40 ring-1 ring-foreground/[0.06]"
					)}
				>
					{busy ? <Loader2 className="size-7 animate-spin" /> : <Check className="size-8" strokeWidth={2.5} />}
				</button>
			</div>
		</div>
	);
}

/**
 * The till's lock screen (plan §21): pick who is serving, type their PIN, and the till is
 * theirs — their permissions, their name on every order. Signing out and in again takes a
 * minute at a busy counter; this takes three seconds.
 */
export function SwitchUserScreen() {
	const t = useTranslations("pin");
	const tRole = useTranslations("roles");
	const open = useSwitchUser((s) => s.open);
	const setOpen = useSwitchUser((s) => s.setOpen);
	const { business } = useActiveBusiness();
	const roster = useRoster(open);
	const queryClient = useQueryClient();
	const [picked, setPicked] = useState<RosterEntry | null>(null);
	const [pin, setPin] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const demo = useSession().user?.isDemo === true;

	const close = () => {
		setOpen(false);
		setPicked(null);
		setPin("");
		setError(null);
	};

	const submit = async () => {
		if (!picked || pin.length < PIN_MIN || busy) return;
		setBusy(true);
		setError(null);
		try {
			const response = await fetch("/api/auth/pin-login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ businessId: business.id, memberId: picked.id, pin }),
			});
			if (response.ok) {
				// The next person must not see this person's cache; a full load (not a client
				// navigation) re-reads the session, the shop and every permission as them.
				queryClient.clear();
				// eslint-disable-next-line @next/next/no-location-assign-relative-destination
				window.location.assign("/pos");
				return;
			}
			const body = (await response.json().catch(() => null)) as {
				message?: string;
				details?: { attemptsLeft?: number; lockedUntil?: string };
			} | null;
			setPin("");
			if (response.status === 429 && body?.details?.lockedUntil) {
				setError(t("locked", { time: formatClock(body.details.lockedUntil) }));
			} else if (response.status === 401 && typeof body?.details?.attemptsLeft === "number") {
				setError(
					body.details.attemptsLeft > 0
						? t("wrong", { count: body.details.attemptsLeft })
						: t("lockedNow")
				);
			} else if (response.status === 401 && body?.message === "Wrong PIN") {
				// A demo account: wrong guesses are not counted, so there is no "tries left".
				setError(t("wrongPlain"));
			} else {
				setError(t("failed"));
			}
		} catch {
			setError(t("failed"));
		} finally {
			setBusy(false);
		}
	};

	useEffect(() => {
		if (!open) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") (picked ? () => (setPicked(null), setPin(""), setError(null)) : close)();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	if (typeof document === "undefined") return null;
	const people = (roster.data ?? []).filter((p) => !p.isYou);

	return createPortal(
		<AnimatePresence>
			{open ? (
				<motion.div
					role="dialog"
					aria-modal
					aria-labelledby="switch-title"
					className="fixed inset-0 z-[90] flex flex-col bg-background/95 backdrop-blur-xl"
					style={{
						backgroundImage:
							"radial-gradient(ellipse 50% 40% at 50% 30%, color-mix(in oklab, var(--primary) 12%, transparent), transparent 70%)",
					}}
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
				>
					<div className="flex items-center justify-between px-6 pt-[max(1.25rem,env(safe-area-inset-top))]">
						{picked ? (
							<Button variant="ghost" size="lg" onClick={() => (setPicked(null), setPin(""), setError(null))}>
								<ArrowLeft />
								{t("back")}
							</Button>
						) : (
							<span className="text-muted-foreground text-sm">{business.name}</span>
						)}
						<Button variant="ghost" size="icon-lg" onClick={close} aria-label={t("close")}>
							<X />
						</Button>
					</div>

					<div className="flex flex-1 flex-col items-center justify-center gap-8 overflow-y-auto px-6 pb-10">
						{picked ? (
							<>
								<div className="flex flex-col items-center gap-3 text-center">
									<UserAvatar
										name={picked.name}
										className="size-20 text-3xl shadow-lg shadow-black/25 ring-4 ring-foreground/10"
									/>
									<div className="space-y-1.5">
										<p id="switch-title" className="font-semibold text-2xl tracking-tight">
											{picked.name}
										</p>
										<span className="inline-flex rounded-full bg-foreground/[0.06] px-2.5 py-0.5 text-muted-foreground text-xs">
											{tRole(picked.role)}
										</span>
									</div>
								</div>
								<PinPad value={pin} onChange={setPin} onSubmit={submit} busy={busy} error={error} />
								{demo ? <DemoPinHint /> : null}
							</>
						) : (
							<>
								<div className="text-center">
									<h2 id="switch-title" className="font-semibold text-2xl tracking-tight">
										{t("title")}
									</h2>
									<p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
								</div>
								{demo ? <DemoPinHint /> : null}
								{roster.isPending ? (
									<Loader2 className="size-6 animate-spin text-muted-foreground" />
								) : people.length === 0 ? (
									<p className="max-w-sm text-center text-muted-foreground text-sm">{t("nobody")}</p>
								) : (
									// Centred, however many there are: a shop of two should not sit in the left half of
									// a four-column grid. Two to a row on a phone, fixed-width cards from tablet up.
									<ul className="flex w-full max-w-3xl flex-wrap justify-center gap-3">
										{people.map((p) => (
											<li key={p.id} className="w-[calc(50%-0.375rem)] tablet:w-44">
												<button
													type="button"
													disabled={!p.hasPin}
													onClick={() => setPicked(p)}
													className="surface flex w-full flex-col items-center gap-3 rounded-2xl p-5 text-center transition hover:ring-2 hover:ring-primary/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:ring-0"
												>
													<UserAvatar name={p.name} className="size-14 text-xl" />
													<span className="min-w-0">
														<span className="block truncate font-medium">{p.name}</span>
														<span className="block text-muted-foreground text-xs">
															{p.hasPin ? tRole(p.role) : t("noPin")}
														</span>
													</span>
												</button>
											</li>
										))}
									</ul>
								)}
							</>
						)}
					</div>
				</motion.div>
			) : null}
		</AnimatePresence>,
		document.body
	);
}

/** The demo shop's PIN, on the screen that asks for it: visitors have no other way to know it. */
function DemoPinHint() {
	const t = useTranslations("pin");
	return (
		<p className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-primary text-sm">
			<FlaskConical className="size-4" />
			{t.rich("demoHint", {
				pin: () => <span className="numeric font-semibold tracking-widest">{DEMO_PIN}</span>,
			})}
		</p>
	);
}

/**
 * Whether you appear on this shop's switch screen. Its own control, applied at once: it is not
 * part of setting a PIN, and finding it should not mean opening the PIN form.
 */
export function SwitchVisibilityToggle({ disabled = false }: { disabled?: boolean }) {
	const t = useTranslations("pin");
	const { setHidden } = usePinMutations();
	const me = useRoster().data?.find((p) => p.isYou);
	const shown = !(me?.hiddenFromSwitch ?? false);
	return (
		<label className={cn("flex items-start gap-4", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
			<span className="min-w-0 flex-1">
				<span className="block font-medium text-sm">{t("showOnSwitch")}</span>
				<span className="mt-0.5 block text-muted-foreground text-xs">{t("showOnSwitchHint")}</span>
			</span>
			<Switch
				checked={shown}
				disabled={disabled || !me || setHidden.isPending}
				onCheckedChange={(on) =>
					setHidden.mutate(!on, {
						onSuccess: () => toast.success(on ? t("shownNow") : t("hiddenNow")),
						onError: (err) => toast.error(err.message),
					})
				}
			/>
		</label>
	);
}

/** Setting your own PIN: typed twice, and your password when the account has one. */
export function SetPinDialog({ open, onOpenChange, hasPin }: { open: boolean; onOpenChange: (open: boolean) => void; hasPin: boolean }) {
	const t = useTranslations("pin");
	const { user } = useSession();
	const { setMine, clearMine } = usePinMutations();
	const [password, setPassword] = useState("");
	const [pin, setPin] = useState("");
	const [again, setAgain] = useState("");
	const needsPassword = user?.provider !== "GOOGLE";
	const format = pin.length >= PIN_MIN && pin.length <= PIN_MAX;
	const mismatch = again.length > 0 && again !== pin;
	const valid = format && again === pin && (!needsPassword || password.length > 0);

	const done = () => {
		setPassword("");
		setPin("");
		setAgain("");
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : done())}>
			<DialogContent className="gap-6 p-6 sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<KeyRound className="size-5 text-primary" />
						{hasPin ? t("changeTitle") : t("setTitle")}
					</DialogTitle>
					<DialogDescription>{t("setHint")}</DialogDescription>
				</DialogHeader>
				<form
					className="space-y-4"
					onSubmit={(e) => {
						e.preventDefault();
						if (!valid) return;
						setMine.mutate(
							{ pin, password: needsPassword ? password : undefined },
							{ onSuccess: () => (toast.success(t("saved")), done()), onError: (err) => toast.error(err.message) }
						);
					}}
				>
					{needsPassword ? (
						<div className="space-y-2">
							<Label htmlFor="pin-password">{t("password")}</Label>
							<Input
								maxLength={128}
								id="pin-password"
								type="password"
								autoComplete="current-password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								className="h-11 rounded-xl"
							/>
						</div>
					) : null}
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-2">
							<Label htmlFor="pin-new">{t("newPin")}</Label>
							<Input
								id="pin-new"
								type="password"
								inputMode="numeric"
								autoComplete="off"
								maxLength={PIN_MAX}
								value={pin}
								onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
								className="numeric h-11 rounded-xl text-center text-lg tracking-[0.4em]"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="pin-again">{t("again")}</Label>
							<Input
								id="pin-again"
								type="password"
								inputMode="numeric"
								autoComplete="off"
								maxLength={PIN_MAX}
								value={again}
								onChange={(e) => setAgain(e.target.value.replace(/\D/g, ""))}
								className="numeric h-11 rounded-xl text-center text-lg tracking-[0.4em]"
							/>
						</div>
					</div>
					<p className={cn("text-xs", mismatch ? "text-danger" : "text-muted-foreground")}>
						{mismatch ? t("mismatch") : t("digits")}
					</p>
					<DialogFooter className="-mx-6 -mb-6 mt-2 px-6 py-4">
						{hasPin ? (
							<Button
								type="button"
								variant="ghost"
								size="lg"
								className="mr-auto text-danger"
								disabled={clearMine.isPending}
								onClick={() =>
									clearMine.mutate(undefined, {
										onSuccess: () => (toast.success(t("removed")), done()),
										onError: (err) => toast.error(err.message),
									})
								}
							>
								{t("remove")}
							</Button>
						) : null}
						<Button type="button" variant="outline" size="lg" onClick={done}>
							{t("cancel")}
						</Button>
						<Button type="submit" size="lg" className="brand-gradient" disabled={!valid || setMine.isPending}>
							{t("save")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

/** "มี PIN" next to a name on the employees page. */
export function PinBadge() {
	const t = useTranslations("pin");
	return (
		<StatusBadge tone="neutral">
			<KeyRound className="size-3" />
			{t("badge")}
		</StatusBadge>
	);
}
