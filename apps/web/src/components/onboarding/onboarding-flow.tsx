"use client";

import { Button } from "@posly/ui/components/button";
import { Input } from "@posly/ui/components/input";
import { Label } from "@posly/ui/components/label";
import { Textarea } from "@posly/ui/components/textarea";
import { api } from "@/lib/api/posly";
import { markTourPending } from "@/stores/tour-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { toast } from "sonner";
import { ProductThumb } from "@/components/common/product-thumb";
import { Skeleton } from "@posly/ui/components/skeleton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { BusinessType } from "@posly/types/domain";
import {
	ArrowLeft,
	ArrowRight,
	Briefcase,
	Cake,
	Check,
	Coffee,
	CupSoda,
	ImagePlus,
	Loader2,
	type LucideIcon,
	PackagePlus,
	ShoppingBag,
	Sparkles,
	Store,
	UtensilsCrossed,
	Wand2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { formatTaxId, isThaiTaxId } from "@posly/utils/tax-id";

const STEPS = ["welcome", "type", "info", "products", "ready"] as const;
type Step = (typeof STEPS)[number];

const TYPES: { value: BusinessType; icon: LucideIcon }[] = [
	{ value: "CAFE", icon: Coffee },
	{ value: "RESTAURANT", icon: UtensilsCrossed },
	{ value: "BEVERAGE", icon: CupSoda },
	{ value: "BAKERY", icon: Cake },
	{ value: "RETAIL", icon: ShoppingBag },
	{ value: "SERVICE", icon: Briefcase },
	{ value: "OTHER", icon: Store },
];

/**
 * One option as a row: icon, name and a one-line example, with a radio mark on the right.
 * Rows rather than tall tiles, so seven shop types fit without a lone card on the last line
 * and the example text has room to explain the choice.
 */
function ChoiceCard({
	selected,
	onClick,
	icon: Icon,
	title,
	description,
	className,
}: {
	selected: boolean;
	onClick: () => void;
	icon: LucideIcon;
	title: string;
	description?: string;
	className?: string;
}) {
	return (
		<button
			type="button"
			role="radio"
			onClick={onClick}
			aria-checked={selected}
			className={cn(
				"touch-target flex items-center gap-3.5 rounded-xl px-4 py-3.5 text-left transition-[background-color,box-shadow]",
				selected
					? "bg-primary/8 shadow-[inset_0_0_0_1.5px_var(--primary)]"
					: "surface hover:bg-muted/60",
				className
			)}
		>
			<span
				className={cn(
					"flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors",
					selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
				)}
			>
				<Icon className="size-5" />
			</span>
			<span className="min-w-0 flex-1">
				<span className="block font-medium">{title}</span>
				{description ? <span className="mt-0.5 block text-muted-foreground text-xs leading-relaxed">{description}</span> : null}
			</span>
			<span
				aria-hidden
				className={cn(
					"flex size-5 shrink-0 items-center justify-center rounded-full transition-colors",
					selected ? "bg-primary text-primary-foreground" : "shadow-[inset_0_0_0_1.5px_var(--border)]"
				)}
			>
				{selected ? <Check className="size-3" strokeWidth={3} /> : null}
			</span>
		</button>
	);
}

/** "ขั้นตอน 1 จาก 3" above each step's title, so the header dots have words too. */
function StepHeading({ step, title, hint }: { step: number; title: string; hint: string }) {
	const t = useTranslations("onboarding");
	return (
		<div className="space-y-1.5">
			<p className="font-medium text-primary text-sm">{t("progress", { step, total: 3 })}</p>
			<h1 className="font-semibold text-2xl tracking-tight tablet:text-3xl">{title}</h1>
			<p className="text-muted-foreground">{hint}</p>
		</div>
	);
}

/**
 * Exactly what "use sample data" will create for the chosen type, read from the API that
 * seeds it — so a restaurant sees rice and noodle dishes, not the cafe's coffee.
 */
function SamplePreview({ type }: { type: BusinessType }) {
	const t = useTranslations("onboarding");
	const preview = useQuery({
		queryKey: ["sample-preview", type],
		queryFn: ({ signal }) => api.catalog.samplePreview(type, signal),
		staleTime: Number.POSITIVE_INFINITY,
	});
	const count = preview.data?.reduce((n, c) => n + c.products.length, 0) ?? 0;

	return (
		<div className="surface space-y-4 rounded-2xl p-4">
			<p className="text-muted-foreground text-sm">
				{preview.data ? t("sampleSummary", { count, categories: preview.data.length }) : t("sampleLoading")}
			</p>
			{preview.data ? (
				<div className="space-y-3">
					{preview.data.map((category) => (
						<div key={category.name} className="space-y-1.5">
							<p className="font-medium text-xs">{category.name}</p>
							<div className="flex flex-wrap gap-1.5">
								{category.products.map((product) => (
									<span
										key={product.name}
										className="flex h-8 items-center gap-2 rounded-lg bg-muted/60 pr-2.5 pl-1 text-sm"
									>
										<ProductThumb art={product.art} name={product.name} className="size-6" rounded="rounded-md" />
										{product.name}
									</span>
								))}
							</div>
						</div>
					))}
				</div>
			) : preview.isError ? null : (
				<div className="flex flex-wrap gap-1.5">
					{[96, 72, 110, 84, 64, 100].map((w) => (
						<Skeleton key={w} className="h-8 rounded-lg" style={{ width: w }} />
					))}
				</div>
			)}
		</div>
	);
}

type CreatePhase = "business" | "catalog" | "finishing";

/**
 * Shown in place of the last step while the shop is created. Creation is two or three API
 * calls; naming each one and ticking it off as it lands reads as progress rather than a
 * frozen button, and the sample menu (the slow part) says what it is doing.
 */
function CreatingChecklist({ phase, withSample }: { phase: CreatePhase; withSample: boolean }) {
	const t = useTranslations("onboarding");
	const phases: CreatePhase[] = withSample ? ["business", "catalog", "finishing"] : ["business", "finishing"];
	const at = phases.indexOf(phase);
	return (
		<div className="space-y-7" role="status" aria-live="polite">
			<div className="space-y-1.5 text-center">
				<span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
					<Loader2 className="size-7 animate-spin" />
				</span>
				<h1 className="font-semibold text-2xl tracking-tight tablet:text-3xl">{t("creatingTitle")}</h1>
				<p className="text-muted-foreground">{t("creatingHint")}</p>
			</div>
			<ol className="surface mx-auto max-w-sm space-y-1 rounded-2xl p-2">
				{phases.map((p, i) => {
					const done = i < at;
					const active = i === at;
					return (
						<li
							key={p}
							className={cn(
								"flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
								active && "bg-primary/8 font-medium",
								!done && !active && "text-muted-foreground"
							)}
						>
							<span
								className={cn(
									"flex size-6 shrink-0 items-center justify-center rounded-full",
									done ? "bg-success text-white" : active ? "text-primary" : "shadow-[inset_0_0_0_1.5px_var(--border)]"
								)}
							>
								{done ? <Check className="size-3.5" strokeWidth={3} /> : active ? <Loader2 className="size-4 animate-spin" /> : null}
							</span>
							{t(`creatingStep.${p}`)}
						</li>
					);
				})}
			</ol>
		</div>
	);
}

/**
 * First-run setup (plan §6): welcome → store type → store info → first products → ready.
 *
 * On completion this will call POST /businesses (which also creates the default branch and
 * the OWNER membership) and, for sample data, seed the catalogue for the chosen type.
 */
export function OnboardingFlow() {
	const t = useTranslations("onboarding");
	const tType = useTranslations("businessType");
	const [step, setStep] = useState<Step>("welcome");
	const [type, setType] = useState<BusinessType>("CAFE");
	const [name, setName] = useState("");
	const [products, setProducts] = useState<"sample" | "manual">("sample");
	const [phone, setPhone] = useState("");
	const [taxId, setTaxId] = useState("");
	const [address, setAddress] = useState("");
	const [creating, setCreating] = useState(false);
	/** Which part of creation is running, for the checklist shown while it does. */
	const [phase, setPhase] = useState<CreatePhase>("business");
	const setBusiness = useWorkspaceStore((s) => s.setBusiness);
	const queryClient = useQueryClient();

	const index = STEPS.indexOf(step);
	const advance = () => setStep(STEPS[Math.min(index + 1, STEPS.length - 1)]);

	/**
	 * The last real step creates everything: the business (with its default branch and the
	 * caller's OWNER membership, server-side), the sample menu if chosen, and the onboarded
	 * flag. Only then does "ready" appear.
	 */
	const finish = async () => {
		setPhase("business");
		setCreating(true);
		try {
			const business = await api.businesses.create({
				name: name.trim(),
				businessType: type,
				phone: phone.trim() || undefined,
				address: address.trim() || undefined,
				taxId: taxId || undefined,
			});
			if (products === "sample") {
				setPhase("catalog");
				await api.catalog.seedSample(business.id);
			}
			setPhase("finishing");
			await api.businesses.completeOnboarding(business.id);
			// The first visit to the new shop opens the guided tour.
			markTourPending();
			setBusiness(business.id);
			await queryClient.invalidateQueries({ queryKey: ["businesses"] });
			advance();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : t("failed"));
		} finally {
			setCreating(false);
		}
	};
	const next = () => (step === "products" ? void finish() : advance());
	const back = () => setStep(STEPS[Math.max(index - 1, 0)]);
	// A typo'd tax id would be refused by the API and lose the whole shop creation.
	const taxIdOk = taxId === "" || isThaiTaxId(taxId);
	const canContinue = (step !== "info" || (name.trim().length > 0 && taxIdOk)) && !creating;

	return (
		<div className="flex min-h-svh flex-col bg-background">
			<header className="flex h-16 items-center justify-between px-4 tablet:px-8">
				{/* Spacer: keeps the progress bar centred against the one on the right. */}
				<span className="w-9" />
				{index > 0 && index < STEPS.length - 1 ? (
					<div className="flex items-center gap-1.5" aria-label={t("progress", { step: index, total: 3 })}>
						{[1, 2, 3].map((n) => (
							<span key={n} className={cn("h-1.5 rounded-full transition-all", n <= index ? "w-8 bg-primary" : "w-4 bg-border")} />
						))}
					</div>
				) : null}
				<span className="w-9" />
			</header>

			<main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 pb-16">
				<AnimatePresence mode="wait">
					<motion.div
						key={creating ? "creating" : step}
						initial={{ opacity: 0, x: 16 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: -16 }}
						transition={{ duration: 0.2 }}
						className="space-y-7"
					>
						{step === "welcome" ? (
							<div className="space-y-4 text-center">
								<span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-accent text-primary">
									<Sparkles className="size-8" />
								</span>
								<h1 className="font-semibold text-3xl tracking-tight">{t("welcomeTitle")}</h1>
								<p className="text-muted-foreground">{t("welcomeHint")}</p>
							</div>
						) : null}

						{step === "type" ? (
							<>
								<StepHeading step={1} title={t("typeTitle")} hint={t("typeHint")} />
								<div role="radiogroup" aria-label={t("typeTitle")} className="grid gap-2.5 tablet:grid-cols-2">
									{TYPES.map(({ value, icon }) => (
										<ChoiceCard
											key={value}
											selected={type === value}
											onClick={() => setType(value)}
											icon={icon}
											title={tType(value)}
											description={t(`typeExample.${value}`)}
											// The odd one out spans the row instead of sitting alone under the grid.
											className={value === "OTHER" ? "tablet:col-span-2" : undefined}
										/>
									))}
								</div>
							</>
						) : null}

						{step === "info" ? (
							<>
								<StepHeading step={2} title={t("infoTitle")} hint={t("infoHint")} />
								<div className="space-y-4">
									<label className="flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed p-4 hover:bg-muted/50">
										<span className="flex size-14 items-center justify-center rounded-xl bg-muted">
											<ImagePlus className="size-6 text-muted-foreground" />
										</span>
										<span>
											<span className="block font-medium text-sm">{t("logo")}</span>
											<span className="block text-muted-foreground text-xs">{t("logoHint")}</span>
										</span>
										<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" />
									</label>
									<div className="space-y-1.5">
										<Label htmlFor="ob-name">{t("storeName")}</Label>
										<Input id="ob-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sunny Cafe" className="h-11 rounded-xl" />
									</div>
									<div className="grid gap-4 tablet:grid-cols-2">
										<div className="space-y-1.5">
											<Label htmlFor="ob-phone">{t("phone")}</Label>
											<Input id="ob-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 rounded-xl" />
										</div>
										<div className="space-y-1.5">
											<Label htmlFor="ob-tax">{t("taxId")}</Label>
											<Input id="ob-tax" inputMode="numeric" value={formatTaxId(taxId)} onChange={(e) => setTaxId(e.target.value.replace(/\D/g, "").slice(0, 13))} className="numeric h-11 rounded-xl" placeholder={t("optional")} />
											{taxIdOk ? null : <p className="text-danger text-xs">{t("taxIdInvalid")}</p>}
										</div>
									</div>
									<div className="space-y-1.5">
										<Label htmlFor="ob-address">{t("address")}</Label>
										<Textarea id="ob-address" value={address} onChange={(e) => setAddress(e.target.value)} className="min-h-20 rounded-xl" />
									</div>
									<p className="text-muted-foreground text-xs">{t("currencyNote")}</p>
								</div>
							</>
						) : null}

						{step === "products" && creating ? (
							<CreatingChecklist phase={phase} withSample={products === "sample"} />
						) : null}

						{step === "products" && !creating ? (
							<>
								<StepHeading step={3} title={t("productsTitle")} hint={t("productsHint")} />
								<div role="radiogroup" aria-label={t("productsTitle")} className="grid gap-2.5">
									<ChoiceCard
										selected={products === "sample"}
										onClick={() => setProducts("sample")}
										icon={Wand2}
										title={t("useSample")}
										description={t("useSampleHint")}
									/>
									<ChoiceCard
										selected={products === "manual"}
										onClick={() => setProducts("manual")}
										icon={PackagePlus}
										title={t("addManual")}
										description={t("addManualHint")}
									/>
								</div>
								{products === "sample" ? <SamplePreview type={type} /> : null}
							</>
						) : null}

						{step === "ready" ? (
							<div className="space-y-4 text-center">
								<motion.span
									initial={{ scale: 0.5 }}
									animate={{ scale: 1 }}
									transition={{ type: "spring", stiffness: 400, damping: 20 }}
									className="mx-auto flex size-16 items-center justify-center rounded-full bg-success text-white"
								>
									<Check className="size-8" strokeWidth={3} />
								</motion.span>
								<h1 className="font-semibold text-3xl tracking-tight">{t("readyTitle")}</h1>
								<p className="text-muted-foreground">{t("readyHint", { name: name || "Sunny Cafe" })}</p>
							</div>
						) : null}
					</motion.div>
				</AnimatePresence>

				<div className={cn("mt-8 flex gap-3", creating && "hidden")}>
					{index > 0 && step !== "ready" ? (
						<Button variant="ghost" size="lg" className="h-12 rounded-xl px-5 text-muted-foreground" onClick={back}>
							<ArrowLeft />
							{t("back")}
						</Button>
					) : null}
					{step === "ready" ? (
						<Button size="lg" className="brand-gradient h-12 flex-1 rounded-xl text-base" onClick={() => 
								// A full navigation, not router.push: the client router cached the app
								// layout's "no shop yet → onboarding" redirect from before the shop existed.
								window.location.assign(products === "sample" ? "/pos" : "/products/new")}>
							{t("startSelling")}
							<ArrowRight />
						</Button>
					) : (
						<Button size="lg" className="brand-gradient h-12 flex-1 rounded-xl text-base" disabled={!canContinue} onClick={next}>
							{step === "welcome" ? t("start") : step === "products" ? t("create") : t("continue")}
							<ArrowRight />
						</Button>
					)}
				</div>
			</main>
		</div>
	);
}
