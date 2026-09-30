"use client";

import { PageContainer, SectionTitle, StatusBadge, Surface } from "@/components/common/primitives";
import { StoreAvatar } from "@/components/layout/brand";
import { Button } from "@posly/ui/components/button";
import { Input } from "@posly/ui/components/input";
import { Label } from "@posly/ui/components/label";
import { Switch } from "@posly/ui/components/switch";
import { Textarea } from "@posly/ui/components/textarea";
import {
	useBilling,
	useNotificationPreferences,
	usePlans,
	useUpdateBusiness,
	useUpdateNotificationPreferences,
} from "@/hooks/use-posly";
import type { NotificationKind, PlanCode, PlanDto } from "@/lib/api/posly";
import { useSubscription } from "@/components/providers/workspace-provider";
import { Skeleton } from "@posly/ui/components/skeleton";
import { useActiveBusiness } from "@/hooks/use-workspace";
import { uploadImage } from "@/lib/api/uploads";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/common/controls";
import { useSearchParams } from "next/navigation";
import { formatThaiDate, formatNumber } from "@posly/utils/format";
import { addedTax, formatBaht, includedTax } from "@posly/utils/money";
import { formatTaxId, isThaiTaxId } from "@posly/utils/tax-id";
import { cn } from "@/lib/utils";
import {
	Ban,
	Bell,
	ChartNoAxesColumn,
	Check,
	Clock3,
	ChevronLeft,
	ChevronRight,
	CreditCard,
	Gauge,
	ImagePlus,
	Loader2,
	PackageMinus,
	PackageX,
	Percent,
	ReceiptText,
	Sparkles,
	Store,
	TriangleAlert,
	Undo2,
	UsersRound,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useEffectEvent, useState } from "react";
import { toast } from "sonner";

export const SETTINGS_SECTIONS = [
	{ key: "general", href: "/settings/general", icon: Store },
	{ key: "payment", href: "/settings/payment", icon: CreditCard },
	{ key: "receipt", href: "/settings/receipt", icon: ReceiptText },
	{ key: "tax", href: "/settings/tax", icon: Percent },
	{ key: "employees", href: "/employees", icon: UsersRound },
	{ key: "notifications", href: "/settings/notifications", icon: Bell },
	{ key: "subscription", href: "/settings/subscription", icon: Sparkles },
] as const;

/** Settings index (plan §23): a list on a phone, and the left rail of every settings page. */
export function SettingsNav({ variant = "rail" }: { variant?: "rail" | "list" }) {
	const t = useTranslations("settings");
	const pathname = usePathname();

	return (
		<nav className={cn(variant === "list" ? "grid gap-1" : "grid gap-0.5")}>
			{SETTINGS_SECTIONS.map(({ key, href, icon: Icon }) => {
				const active = pathname === href;
				return (
					<Link
						key={key}
						// Employees is a page of its own; the flag tells it to offer a way back here.
						href={key === "employees" ? { pathname: href, query: { from: "settings" } } : href}
						className={cn(
							"flex items-center gap-3 rounded-xl px-3 font-medium text-sm transition-colors",
							variant === "list" ? "h-14 bg-card shadow-xs" : "h-10",
							active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
						)}
					>
						<Icon className={cn("size-[18px]", active && "text-primary")} />
						<span className="flex-1">{t(`sections.${key}`)}</span>
						{variant === "list" ? <ChevronRight className="size-4" /> : null}
					</Link>
				);
			})}
		</nav>
	);
}

/**
 * "‹ Settings", phones only. There is no settings rail on a phone, so a section page — and
 * the employees page when opened from the settings list — needs its own way back.
 */
export function SettingsBackLink() {
	const t = useTranslations("settings");
	return (
		<Link
			href="/settings"
			className="-ml-2 flex h-9 w-fit items-center gap-0.5 rounded-lg pr-3 pl-1 font-medium text-muted-foreground text-sm transition-colors hover:text-foreground active:bg-muted tablet:hidden"
		>
			<ChevronLeft className="size-5" />
			{t("title")}
		</Link>
	);
}

export function SettingsLayout({ children }: { children: ReactNode }) {
	const t = useTranslations("settings");
	const pathname = usePathname();
	// On a phone the index is the section list, so a section page says which section it is.
	// From tablet up the rail beside it does that.
	const section = SETTINGS_SECTIONS.find((s) => s.href === pathname);
	return (
		<PageContainer>
			{section ? (
				<div className="grid gap-1 tablet:hidden">
					<SettingsBackLink />
					<h1 className="font-semibold text-2xl tracking-tight">{t(`sections.${section.key}`)}</h1>
				</div>
			) : null}
			<h1 className={cn("font-semibold text-2xl tracking-tight", section && "hidden tablet:block")}>{t("title")}</h1>
			<div className="grid gap-6 tablet:grid-cols-[220px_1fr]">
				<aside className="hidden tablet:block">
					<SettingsNav />
				</aside>
				<div className="min-w-0 space-y-4">{children}</div>
			</div>
		</PageContainer>
	);
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
	return (
		<div className="space-y-1.5">
			<Label htmlFor={htmlFor}>{label}</Label>
			{children}
			{hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
		</div>
	);
}

/** Full width on a phone, where the thumb reaches the whole row; right-aligned from tablet up. */
function SaveBar({ onSave, pending }: { onSave: () => void; pending?: boolean }) {
	const t = useTranslations("common");
	return (
		<div className="flex justify-end">
			<Button size="lg" className="brand-gradient h-11 w-full min-w-28 tablet:h-9 tablet:w-auto" disabled={pending} onClick={onSave}>
				{t("save")}
			</Button>
		</div>
	);
}

export function GeneralSettings() {
	const t = useTranslations("settings.general");
	const tCommon = useTranslations("common");
	const { business, can } = useActiveBusiness();
	const update = useUpdateBusiness();
	const [name, setName] = useState(business.name);
	const [phone, setPhone] = useState(business.phone ?? "");
	const [address, setAddress] = useState(business.address ?? "");
	const [uploading, setUploading] = useState(false);
	const editable = can("business:manage");

	const save = (extra: { logoPath?: string } = {}) =>
		update.mutate(
			{ name: name.trim() || business.name, phone: phone.trim() || undefined, address: address.trim() || undefined, ...extra },
			{ onSuccess: () => toast.success(tCommon("saved")), onError: (e) => toast.error(e.message) }
		);

	const onLogo = async (file: File | undefined) => {
		if (!file) return;
		setUploading(true);
		try {
			const { path } = await uploadImage(business.id, file, "business-logo");
			save({ logoPath: path });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : tCommon("error"));
		} finally {
			setUploading(false);
		}
	};

	return (
		<>
			<Surface className="space-y-5">
				<SectionTitle>{t("title")}</SectionTitle>
				<div className="flex items-center gap-4">
					<StoreAvatar name={business.name} logoUrl={business.logoUrl} className="size-16 rounded-2xl text-xl" />
					<div className="space-y-1">
						<Button asChild variant="outline" disabled={!editable || uploading}>
							<label className="cursor-pointer">
								<ImagePlus />
								{t("uploadLogo")}
								<input
									type="file"
									accept="image/jpeg,image/png,image/webp"
									className="sr-only"
									disabled={!editable || uploading}
									onChange={(e) => void onLogo(e.target.files?.[0])}
								/>
							</label>
						</Button>
						<p className="text-muted-foreground text-xs">{t("logoHint")}</p>
					</div>
				</div>
				<div className="grid gap-4 tablet:grid-cols-2">
					<Field label={t("name")} htmlFor="s-name">
						<Input id="s-name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} disabled={!editable} className="h-11 rounded-xl" />
					</Field>
					<Field label={t("phone")} htmlFor="s-phone">
						<Input id="s-phone" maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!editable} className="h-11 rounded-xl" />
					</Field>
				</div>
				<Field label={t("address")} htmlFor="s-address">
					<Textarea id="s-address" maxLength={500} value={address} onChange={(e) => setAddress(e.target.value)} disabled={!editable} className="min-h-20 rounded-xl" />
				</Field>
				<div className="grid gap-4 tablet:grid-cols-2">
					<Field label={t("currency")} htmlFor="s-currency" hint={t("currencyHint")}>
						<Input id="s-currency" value="THB — บาท" disabled className="h-11 rounded-xl" />
					</Field>
					<Field label={t("timezone")} htmlFor="s-tz">
						<Input id="s-tz" value="Asia/Bangkok (GMT+7)" disabled className="h-11 rounded-xl" />
					</Field>
				</div>
			</Surface>
			{editable ? <SaveBar onSave={() => save()} pending={update.isPending} /> : null}
		</>
	);
}

export function PaymentSettings() {
	const t = useTranslations("settings.payment");
	const tCommon = useTranslations("common");
	const { business, can } = useActiveBusiness();
	const update = useUpdateBusiness();
	const [promptPayId, setPromptPayId] = useState(business.promptPayId ?? "");
	const editable = can("business:manage");

	return (
		<>
			<Surface className="space-y-4">
				<SectionTitle>{t("promptPay")}</SectionTitle>
				<Field label={t("promptPayId")} htmlFor="pp-id" hint={t("promptPayHint")}>
					<Input
						maxLength={13}
						id="pp-id"
						value={promptPayId}
						onChange={(e) => setPromptPayId(e.target.value.replace(/\D/g, ""))}
						inputMode="numeric"
						disabled={!editable}
						className="numeric h-11 rounded-xl"
					/>
				</Field>
				<StatusBadge tone="info">{t("manualConfirm")}</StatusBadge>
			</Surface>
			{editable ? (
				<SaveBar
					pending={update.isPending}
					onSave={() =>
						update.mutate(
							{ promptPayId: promptPayId || undefined },
							{ onSuccess: () => toast.success(tCommon("saved")), onError: (e) => toast.error(e.message) }
						)
					}
				/>
			) : null}
		</>
	);
}

/** One of two pricing modes, as a card with a sentence of what it means at the till. */
function ModeCard({
	selected,
	onSelect,
	title,
	hint,
	disabled,
}: {
	selected: boolean;
	onSelect: () => void;
	title: string;
	hint: string;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			role="radio"
			aria-checked={selected}
			disabled={disabled}
			onClick={onSelect}
			className={cn(
				"flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
				selected ? "border-primary/50 bg-primary/5" : "hover:bg-muted/50"
			)}
		>
			<span
				className={cn(
					"mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
					selected ? "border-primary" : "border-muted-foreground/40"
				)}
			>
				{selected ? <span className="size-2 rounded-full bg-primary" /> : null}
			</span>
			<span>
				<span className="block font-medium text-sm">{title}</span>
				<span className="block text-muted-foreground text-xs">{hint}</span>
			</span>
		</button>
	);
}

/**
 * VAT and the tax id (plan §24). Totals are computed by the same rule as the till, so the
 * example on the right is exactly what the next sale will charge.
 */
export function TaxSettings() {
	const t = useTranslations("settings.tax");
	const tCommon = useTranslations("common");
	const { business, can } = useActiveBusiness();
	const update = useUpdateBusiness();
	const editable = can("business:manage");
	const [vatOn, setVatOn] = useState(business.vatBasisPoints > 0);
	const [rate, setRate] = useState(business.vatBasisPoints > 0 ? String(business.vatBasisPoints / 100) : "7");
	const [included, setIncluded] = useState(business.pricesIncludeVat);
	const [taxId, setTaxId] = useState(business.taxId ?? "");

	const rateNumber = Number.parseFloat(rate);
	const rateOk = !vatOn || (rateNumber > 0 && rateNumber <= 30);
	const basisPoints = vatOn && rateOk ? Math.round(rateNumber * 100) : 0;
	const taxIdOk = taxId === "" || isThaiTaxId(taxId);
	const valid = rateOk && taxIdOk;

	const example = 10_000;
	const vat = included ? includedTax(example, basisPoints) : addedTax(example, basisPoints);
	const total = included ? example : example + vat;

	const save = () =>
		update.mutate(
			{ vatBasisPoints: basisPoints, pricesIncludeVat: included, taxId: taxId || null },
			{ onSuccess: () => toast.success(tCommon("saved")), onError: (e) => toast.error(e.message) }
		);

	return (
		<div className="grid gap-4 desktop:grid-cols-[1fr_300px]">
			<div className="space-y-4">
				<Surface className="space-y-5">
					<SectionTitle>{t("vat")}</SectionTitle>
					<label className="flex items-center justify-between gap-4 rounded-xl bg-muted/50 px-4 py-3">
						<span>
							<span className="block font-medium text-sm">{t("registered")}</span>
							<span className="block text-muted-foreground text-xs">{t("registeredHint")}</span>
						</span>
						<Switch checked={vatOn} onCheckedChange={setVatOn} disabled={!editable} />
					</label>
					{vatOn ? (
						<>
							<div className="max-w-40">
								<Field label={t("rate")} htmlFor="tax-rate">
									<div className="relative">
										<Input
											maxLength={5}
											id="tax-rate"
											inputMode="decimal"
											value={rate}
											onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ""))}
											disabled={!editable}
											className="numeric h-11 rounded-xl pr-9 text-right"
										/>
										<span className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-3.5 text-muted-foreground text-sm">
											%
										</span>
									</div>
								</Field>
								{rateOk ? null : <p className="mt-1.5 text-danger text-xs">{t("rateInvalid")}</p>}
							</div>
							<div className="space-y-2" role="radiogroup" aria-label={t("mode")}>
								<Label>{t("mode")}</Label>
								<ModeCard
									selected={included}
									onSelect={() => setIncluded(true)}
									disabled={!editable}
									title={t("included")}
									hint={t("includedHint")}
								/>
								<ModeCard
									selected={!included}
									onSelect={() => setIncluded(false)}
									disabled={!editable}
									title={t("added")}
									hint={t("addedHint")}
								/>
							</div>
						</>
					) : null}
				</Surface>

				<Surface className="space-y-4">
					<SectionTitle>{t("taxIdTitle")}</SectionTitle>
					<Field label={t("taxId")} htmlFor="tax-id" hint={t("taxIdHint")}>
						<Input
							maxLength={17}
							id="tax-id"
							inputMode="numeric"
							value={formatTaxId(taxId)}
							onChange={(e) => setTaxId(e.target.value.replace(/\D/g, "").slice(0, 13))}
							placeholder="0-0000-00000-00-0"
							disabled={!editable}
							className="numeric h-11 max-w-72 rounded-xl"
						/>
					</Field>
					{taxIdOk ? null : <p className="-mt-2 text-danger text-xs">{t("taxIdInvalid")}</p>}
					{vatOn && !taxId ? (
						<p className="rounded-xl bg-warning/10 px-3.5 py-2.5 text-foreground text-xs">{t("needTaxId")}</p>
					) : null}
				</Surface>
				{editable ? (
					<div className="flex justify-end">
						<Button size="lg" className="brand-gradient h-11 w-full min-w-28 tablet:h-9 tablet:w-auto" disabled={!valid || update.isPending} onClick={save}>
							{tCommon("save")}
						</Button>
					</div>
				) : null}
			</div>

			<div className="desktop:sticky desktop:top-24 desktop:self-start">
				<p className="mb-2 font-medium text-muted-foreground text-sm">{t("example")}</p>
				<Surface className="space-y-2.5 text-sm">
					<p className="flex justify-between">
						<span className="text-muted-foreground">{t("examplePrice")}</span>
						<span className="numeric">{formatBaht(example)}</span>
					</p>
					{basisPoints > 0 ? (
						<p className="flex justify-between">
							<span className="text-muted-foreground">
								{included ? t("exampleVatIncluded", { rate: basisPoints / 100 }) : t("exampleVatAdded", { rate: basisPoints / 100 })}
							</span>
							<span className="numeric">{formatBaht(vat)}</span>
						</p>
					) : null}
					<div className="border-t border-dashed" />
					<p className="flex justify-between font-semibold">
						<span>{t("exampleTotal")}</span>
						<span className="numeric">{formatBaht(total)}</span>
					</p>
					<p className="pt-1 text-muted-foreground text-xs">
						{basisPoints === 0 ? t("exampleNoVat") : included ? t("exampleIncludedNote") : t("exampleAddedNote")}
					</p>
				</Surface>
				<p className="mt-3 text-muted-foreground text-xs">{t("newOrdersOnly")}</p>
			</div>
		</div>
	);
}

/** Receipt settings with a live preview (plan §24): what you type is what prints. */
export function ReceiptSettings() {
	const t = useTranslations("settings.receipt");
	const tCommon = useTranslations("common");
	const tReceipt = useTranslations("receipt");
	const { business, can } = useActiveBusiness();
	const update = useUpdateBusiness();
	const editable = can("settings:manage");
	const [showLogo, setShowLogo] = useState(business.receiptShowLogo);
	const [showTaxId, setShowTaxId] = useState(business.receiptShowTaxId);
	const [footer, setFooter] = useState(business.receiptFooter ?? "");

	const save = () =>
		update.mutate(
			{ receiptShowLogo: showLogo, receiptShowTaxId: showTaxId, receiptFooter: footer.trim() || null },
			{ onSuccess: () => toast.success(tCommon("saved")), onError: (e) => toast.error(e.message) }
		);

	return (
		<div className="grid gap-4 desktop:grid-cols-[1fr_320px]">
			<div className="space-y-4">
				<Surface className="space-y-4">
					<SectionTitle>{t("title")}</SectionTitle>
					<div className="flex items-center justify-between gap-4">
						<div>
							<Label htmlFor="r-logo">{t("showLogo")}</Label>
							{business.logoUrl ? null : <p className="text-muted-foreground text-xs">{t("noLogo")}</p>}
						</div>
						<Switch id="r-logo" checked={showLogo} onCheckedChange={setShowLogo} disabled={!editable} />
					</div>
					<div className="flex items-center justify-between gap-4">
						<div>
							<Label htmlFor="r-tax">{t("showTaxId")}</Label>
							{business.taxId ? null : <p className="text-muted-foreground text-xs">{t("noTaxId")}</p>}
						</div>
						<Switch id="r-tax" checked={showTaxId} onCheckedChange={setShowTaxId} disabled={!editable} />
					</div>
					<Field label={t("footer")} htmlFor="r-footer" hint={t("footerHint")}>
						<Textarea
							id="r-footer"
							value={footer}
							maxLength={300}
							placeholder={tReceipt("thanks")}
							onChange={(e) => setFooter(e.target.value)}
							disabled={!editable}
							className="min-h-20 rounded-xl"
						/>
					</Field>
				</Surface>
				{editable ? <SaveBar onSave={save} pending={update.isPending} /> : null}
			</div>

			<div className="desktop:sticky desktop:top-24 desktop:self-start">
				<p className="mb-2 font-medium text-muted-foreground text-sm">{t("preview")}</p>
				<div className="rounded-2xl bg-white p-6 font-mono text-[#111827] text-xs shadow-md ring-1 ring-black/5">
					<div className="space-y-1 text-center">
						{showLogo && business.logoUrl ? (
							<div className="mb-2 flex justify-center">
								<StoreAvatar name={business.name} logoUrl={business.logoUrl} className="size-10 grayscale" />
							</div>
						) : null}
						<p className="font-bold font-sans text-sm">{business.name}</p>
						{business.address ? <p className="text-[#64748b]">{business.address}</p> : null}
						{business.phone ? <p className="text-[#64748b]">โทร {business.phone}</p> : null}
						{showTaxId && business.taxId ? <p className="text-[#64748b]">เลขผู้เสียภาษี {business.taxId}</p> : null}
					</div>
					<div className="my-3 border-[#cbd5e1] border-t border-dashed" />
					<p>Order #000124</p>
					<p className="text-[#64748b]">26/09/2569 10:24 · มายด์</p>
					<div className="my-3 border-[#cbd5e1] border-t border-dashed" />
					{[
						["Americano", 6000],
						["Latte", 7000],
					].map(([name, price]) => (
						<p key={name} className="flex justify-between">
							<span>{name}</span>
							<span>{formatBaht(price as number)}</span>
						</p>
					))}
					<div className="my-3 border-[#cbd5e1] border-t border-dashed" />
					<p className="flex justify-between font-bold text-sm">
						<span>Total</span>
						<span>{formatBaht(13_000)}</span>
					</p>
					<p className="mt-1 text-[#64748b]">PromptPay</p>
					<p className="mt-4 whitespace-pre-line text-center font-sans">{footer.trim() || tReceipt("thanks")}</p>
				</div>
			</div>
		</div>
	);
}

/** One usage bar: "ออเดอร์เดือนนี้ 38 / 100", amber near the limit, red at it. */
function UsageMeter({
	label,
	used,
	limit,
	warn = false,
}: {
	label: string;
	used: number;
	limit: number | null;
	/** Colour the bar as it nears the limit — for a quota that runs out, not a seat count. */
	warn?: boolean;
}) {
	const t = useTranslations("settings.subscription");
	const ratio = limit ? Math.min(1, used / limit) : 0;
	return (
		<div className="space-y-1.5">
			<div className="flex items-baseline justify-between gap-3 text-sm">
				<span className="text-muted-foreground">{label}</span>
				<span className="numeric font-medium">
					{formatNumber(used)}
					<span className="text-muted-foreground"> / {limit === null ? t("unlimited") : formatNumber(limit)}</span>
				</span>
			</div>
			<span className="block h-1.5 overflow-hidden rounded-full bg-muted">
				<span
					className={cn(
						"block h-full rounded-full transition-[width]",
						limit === null
							? "w-full bg-success/40"
							: warn && ratio >= 1
								? "bg-danger"
								: warn && ratio >= 0.8
									? "bg-warning"
									: "bg-primary"
					)}
					style={limit === null ? undefined : { width: `${Math.max(ratio * 100, used > 0 ? 3 : 0)}%` }}
				/>
			</span>
		</div>
	);
}

/**
 * Plans (plan §25). Everything here comes from the API: the plan list from `GET /plans`, the
 * shop's plan, limits and usage from its resolved subscription. The page never decides what
 * a plan includes.
 *
 * Changing plan waits for payments (Phase 2) — a free self-serve switch would give every
 * plan away — so the buttons say so instead of pretending.
 */
type PlanAction =
	| { kind: "none"; label: string }
	| { kind: "checkout"; label: string }
	| { kind: "change"; label: string; confirm: "upgrade" | "downgrade" | "cancel" | "resume" };

/**
 * The plan, its usage, and the way to change it (plan §26). Paying is Stripe's: checkout for
 * the first plan, the portal for the card and invoices; switching between paid plans (and
 * cancelling back to Free) happens here, prorated by Stripe.
 */
export function SubscriptionSettings() {
	const t = useTranslations("settings.subscription");
	const subscription = useSubscription();
	const plans = usePlans();
	const billing = useBilling();
	const { can } = useActiveBusiness();
	const canPay = can("subscription:manage");
	const searchParams = useSearchParams();
	const router = useRouter();
	const pathname = usePathname();
	const [confirming, setConfirming] = useState<{ plan: PlanDto; action: Extract<PlanAction, { kind: "change" }> } | null>(null);
	const lapsed = subscription.plan !== subscription.subscribedPlan;
	const pastDue = subscription.status === "PAST_DUE";

	// Back from Stripe Checkout. The webhook usually lands within seconds; re-read the shop
	// until it does, so the page does not show Free next to a success message. Handled once
	// per return: the effect event keeps the latest router and query client out of the deps.
	const returned = searchParams.get("checkout");
	const onReturn = useEffectEvent((outcome: string) => {
		router.replace(pathname);
		if (outcome !== "success") {
			toast.info(t("checkoutCancelled"), { id: "checkout-return" });
			return undefined;
		}
		toast.success(t("checkoutSuccess"), { id: "checkout-return" });
		let tries = 0;
		const timer = setInterval(() => {
			tries += 1;
			void billing.refresh();
			if (tries >= 15) clearInterval(timer);
		}, 2000);
		return timer;
	});
	useEffect(() => {
		if (!returned) return;
		const timer = onReturn(returned);
		return () => clearInterval(timer);
	}, [returned]);

	const planName = (code: PlanCode) => plans.data?.find((p) => p.code === code)?.name ?? code;
	const priceOf = (code: PlanCode) => plans.data?.find((p) => p.code === code)?.monthlyPrice ?? 0;

	const actionFor = (plan: PlanDto): PlanAction => {
		const current = plan.code === (subscription.billedOnline ? subscription.subscribedPlan : subscription.plan);
		if (!subscription.onlinePayment || !canPay) {
			return { kind: "none", label: current ? t("currentPlan") : t("upgradeSoon") };
		}
		if (!subscription.billedOnline) {
			if (current || plan.monthlyPrice === 0) return { kind: "none", label: current ? t("currentPlan") : t("free") };
			return { kind: "checkout", label: t("choose") };
		}
		if (current) {
			return subscription.cancelAtPeriodEnd
				? { kind: "change", label: t("resume"), confirm: "resume" }
				: { kind: "none", label: t("currentPlan") };
		}
		if (plan.monthlyPrice === 0) {
			return subscription.cancelAtPeriodEnd
				? { kind: "none", label: t("switchingToFree") }
				: { kind: "change", label: t("cancelToFree"), confirm: "cancel" };
		}
		const upgrade = plan.monthlyPrice > priceOf(subscription.subscribedPlan);
		return { kind: "change", label: t("switchTo"), confirm: upgrade ? "upgrade" : "downgrade" };
	};

	const run = (plan: PlanDto, action: PlanAction) => {
		if (action.kind === "checkout") {
			billing.checkout.mutate(plan.code, { onError: (e) => toast.error(e.message) });
		} else if (action.kind === "change") {
			setConfirming({ plan, action });
		}
	};
	const pending = billing.checkout.isPending || billing.change.isPending || billing.portal.isPending;
	const endDate = subscription.endDate ? formatThaiDate(subscription.endDate) : "";

	return (
		<>
			{pastDue && subscription.billedOnline ? (
				<div className="flex flex-col gap-3 rounded-2xl bg-danger/10 px-5 py-4 tablet:flex-row tablet:items-center">
					<CreditCard className="size-5 shrink-0 text-danger" />
					<p className="flex-1 text-sm">
						<span className="block font-semibold text-danger">{t("pastDueTitle")}</span>
						{t("pastDueHint", { plan: planName(subscription.subscribedPlan) })}
					</p>
					{canPay ? (
						<Button size="lg" variant="outline" disabled={pending} onClick={() => billing.portal.mutate(undefined, { onError: (e) => toast.error(e.message) })}>
							{t("updateCard")}
						</Button>
					) : null}
				</div>
			) : null}

			<Surface className="space-y-5">
				<div className="flex flex-col gap-3 tablet:flex-row tablet:items-start tablet:justify-between">
					<div>
						<p className="text-muted-foreground text-sm">{t("current")}</p>
						<p className="mt-0.5 flex items-center gap-2 font-semibold text-xl">
							{subscription.planName}
							{pastDue ? (
								<StatusBadge tone="danger" dot>
									{t("pastDue")}
								</StatusBadge>
							) : lapsed ? (
								<StatusBadge tone="warning" dot>
									{t("lapsed", { plan: subscription.subscribedPlan })}
								</StatusBadge>
							) : (
								<StatusBadge tone="success" dot>
									{t("active")}
								</StatusBadge>
							)}
						</p>
						<p className="text-muted-foreground text-sm">
							{subscription.endDate
								? subscription.cancelAtPeriodEnd
									? t("endsToFree", { date: endDate })
									: t("renews", { date: endDate })
								: t("openEnded")}
						</p>
					</div>
					{subscription.billedOnline && canPay ? (
						<Button
							variant="outline"
							size="lg"
							disabled={pending}
							onClick={() => billing.portal.mutate(undefined, { onError: (e) => toast.error(e.message) })}
						>
							{billing.portal.isPending ? <Loader2 className="animate-spin" /> : <CreditCard />}
							{t("manage")}
						</Button>
					) : null}
				</div>
				<div className="grid gap-4 tablet:grid-cols-3">
					<UsageMeter
						warn
						label={t("usageOrders")}
						used={subscription.usage.ordersThisMonth}
						limit={subscription.limits.orders}
					/>
					<UsageMeter label={t("usageMembers")} used={subscription.usage.members} limit={subscription.limits.members} />
					<UsageMeter label={t("usageBranches")} used={subscription.usage.branches} limit={subscription.limits.branches} />
				</div>
			</Surface>

			<div className="grid gap-3 tablet:grid-cols-2 desktop:grid-cols-4">
				{plans.isPending
					? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-80 rounded-2xl" />)
					: (plans.data ?? []).map((plan) => {
							const isCurrent = plan.code === (subscription.billedOnline ? subscription.subscribedPlan : subscription.plan);
							const featured = plan.code === "PRO";
							const action = actionFor(plan);
							const busy =
								(billing.checkout.isPending && billing.checkout.variables === plan.code) ||
								(billing.change.isPending && billing.change.variables === plan.code);
							return (
								<div
									key={plan.code}
									className={cn(
										"surface flex flex-col gap-4 rounded-2xl p-5",
										isCurrent ? "ring-2 ring-primary" : featured && "ring-1 ring-primary/40"
									)}
								>
									<div className="flex items-center justify-between">
										<p className="font-semibold">{plan.name}</p>
										{isCurrent ? (
											<StatusBadge tone="primary">{t("currentPlan")}</StatusBadge>
										) : featured ? (
											<StatusBadge tone="neutral">{t("popular")}</StatusBadge>
										) : null}
									</div>
									<p>
										<span className="numeric font-bold text-3xl">
											{plan.monthlyPrice === 0 ? t("free") : formatBaht(plan.monthlyPrice)}
										</span>
										{plan.monthlyPrice === 0 ? null : <span className="text-muted-foreground text-sm"> / {t("month")}</span>}
									</p>
									<ul className="flex-1 space-y-2 text-sm">
										{plan.highlights.map((h) => (
											<li key={h.label} className={cn("flex gap-2", h.soon && "text-muted-foreground")}>
												{h.soon ? (
													<Clock3 className="mt-0.5 size-4 shrink-0" />
												) : (
													<Check className="mt-0.5 size-4 shrink-0 text-success" />
												)}
												<span>
													{h.label}
													{h.soon ? (
														<span className="ml-1.5 whitespace-nowrap rounded-full bg-muted px-1.5 py-0.5 font-medium text-[11px]">
															{t("soon")}
														</span>
													) : null}
												</span>
											</li>
										))}
									</ul>
									<Button
										size="lg"
										variant={action.kind === "checkout" && featured ? "default" : "outline"}
										className={cn(action.kind === "checkout" && featured && "brand-gradient")}
										disabled={action.kind === "none" || pending}
										onClick={() => run(plan, action)}
									>
										{busy ? <Loader2 className="animate-spin" /> : null}
										{action.label}
									</Button>
								</div>
							);
						})}
			</div>
			<p className="text-muted-foreground text-xs">
				{!subscription.onlinePayment ? t("changeNote") : !canPay ? t("ownerOnly") : t("stripeNote")}
			</p>

			<ConfirmDialog
				open={confirming !== null}
				onOpenChange={(open) => !open && setConfirming(null)}
				destructive={confirming?.action.confirm === "cancel"}
				icon={confirming?.action.confirm === "cancel" ? TriangleAlert : CreditCard}
				title={
					confirming
						? t(`confirm.${confirming.action.confirm}.title`, { plan: confirming.plan.name })
						: ""
				}
				description={
					confirming
						? t(`confirm.${confirming.action.confirm}.body`, {
								plan: confirming.plan.name,
								price: formatBaht(confirming.plan.monthlyPrice),
								date: endDate,
							})
						: ""
				}
				confirmLabel={confirming ? t(`confirm.${confirming.action.confirm}.cta`) : ""}
				cancelLabel={t("keep")}
				onConfirm={() => {
					if (!confirming) return;
					const { plan, action } = confirming;
					billing.change.mutate(plan.code, {
						onSuccess: () => toast.success(t(`confirm.${action.confirm}.done`, { plan: plan.name, date: endDate })),
						onError: (e) => toast.error(e.message),
					});
				}}
			/>
		</>
	);
}

const NOTIFICATION_ICON: Record<NotificationKind, typeof Bell> = {
	LOW_STOCK: PackageMinus,
	OUT_OF_STOCK: PackageX,
	REFUND: Undo2,
	CANCELLED: Ban,
	DAILY_SUMMARY: ChartNoAxesColumn,
	ORDER_QUOTA: Gauge,
	PAYMENT_FAILED: CreditCard,
};

/**
 * What this person hears about (plan §28). Per member, not per shop: an owner can mute
 * daily summaries without silencing them for the manager. Each switch saves on its own.
 */
export function NotificationSettings() {
	const t = useTranslations("settings.notifications");
	const prefs = useNotificationPreferences();
	const update = useUpdateNotificationPreferences();

	const toggle = (kind: NotificationKind, enabled: boolean) => {
		const muted = (prefs.data ?? [])
			.filter((p) => (p.kind === kind ? !enabled : !p.enabled))
			.map((p) => p.kind);
		update.mutate(muted, { onError: (e) => toast.error(e.message) });
	};

	return (
		<Surface className="space-y-4">
			<div>
				<SectionTitle>{t("title")}</SectionTitle>
				<p className="-mt-2 text-muted-foreground text-sm">{t("hint")}</p>
			</div>
			{prefs.isPending ? (
				<div className="grid gap-2">
					{[0, 1, 2, 3].map((i) => (
						<Skeleton key={i} className="h-16 rounded-xl" />
					))}
				</div>
			) : (
				<ul className="divide-y rounded-xl border">
					{(prefs.data ?? []).map((p) => {
						const Icon = NOTIFICATION_ICON[p.kind];
						return (
							<li key={p.kind}>
								<label className="flex cursor-pointer items-center gap-3 px-4 py-3.5">
									<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
										<Icon className="size-4" />
									</span>
									<span className="min-w-0 flex-1">
										<span className="block font-medium text-sm">{t(`kinds.${p.kind}.title`)}</span>
										<span className="block text-muted-foreground text-xs">{t(`kinds.${p.kind}.hint`)}</span>
									</span>
									<Switch
										checked={p.enabled}
										disabled={update.isPending}
										onCheckedChange={(on) => toggle(p.kind, on)}
									/>
								</label>
							</li>
						);
					})}
				</ul>
			)}
			<p className="text-muted-foreground text-xs">{t("lineSoon")}</p>
		</Surface>
	);
}
