import { BrandMark } from "@/components/layout/brand";
import { DemoDialog } from "@/components/demo/demo-dialog";
import { LandingHeader } from "@/components/landing/landing-header";
import { DashboardMockup, PosMockup, SalesCard, ToastCards } from "@/components/landing/mockups";
import { Float, Reveal, Stagger, StaggerItem, TiltIn } from "@/components/landing/motion";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@posly/ui/components/accordion";
import { Button } from "@posly/ui/components/button";
import { Link } from "@/i18n/navigation";
import { getPublicPlans } from "@/lib/api/public-plans";
import { env } from "@/lib/env";
import { formatBaht } from "@posly/utils/money";
import { cn } from "@/lib/utils";
import {
	ArrowRight,
	BarChart3,
	Boxes,
	Briefcase,
	Cake,
	Check,
	Clock3,
	Coffee,
	CupSoda,
	QrCode,
	ReceiptText,
	ShieldCheck,
	ShoppingBag,
	Store,
	UtensilsCrossed,
	Zap,
	type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

const TYPE_ICONS: LucideIcon[] = [Coffee, UtensilsCrossed, CupSoda, Cake, ShoppingBag, Briefcase];

const FEATURES: { key: "pos" | "payment" | "stock" | "reports" | "staff" | "receipt"; icon: LucideIcon }[] = [
	{ key: "pos", icon: Zap },
	{ key: "payment", icon: QrCode },
	{ key: "stock", icon: Boxes },
	{ key: "reports", icon: BarChart3 },
	{ key: "staff", icon: ShieldCheck },
	{ key: "receipt", icon: ReceiptText },
];

function SectionHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
	return (
		<Reveal className="mx-auto max-w-2xl text-center">
			<p className="font-semibold text-primary text-sm">{eyebrow}</p>
			<h2 className="mt-2 text-balance font-semibold text-3xl tracking-tight tablet:text-4xl">{title}</h2>
			{subtitle ? <p className="mt-4 text-pretty text-lg text-muted-foreground">{subtitle}</p> : null}
		</Reveal>
	);
}

function Section({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
	return (
		<section id={id} className={cn("scroll-mt-20 px-4 py-20 tablet:px-6 desktop:py-28", className)}>
			<div className="mx-auto max-w-6xl">{children}</div>
		</section>
	);
}

/** A soft brand glow behind the hero: one radial wash and a fading dot grid. */
function HeroBackdrop() {
	return (
		<div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
			<div
				className="absolute inset-0"
				style={{
					backgroundImage:
						"radial-gradient(ellipse 70% 55% at 50% 0%, color-mix(in oklab, var(--primary) 18%, transparent), transparent 70%)",
				}}
			/>
			<div
				className="absolute inset-0"
				style={{
					backgroundImage: "radial-gradient(color-mix(in oklab, var(--foreground) 10%, transparent) 1px, transparent 1px)",
					backgroundSize: "22px 22px",
					maskImage: "radial-gradient(ellipse 60% 50% at 50% 20%, black, transparent 75%)",
				}}
			/>
		</div>
	);
}

function Showcase({
	eyebrow,
	title,
	body,
	points,
	picture,
	reverse = false,
}: {
	eyebrow: string;
	title: string;
	body: string;
	points: string[];
	picture: ReactNode;
	reverse?: boolean;
}) {
	return (
		// The picture gets the wider column: a product screen shrunk to half the page was cramped.
		<div
			className={cn(
				"grid items-center gap-10 desktop:gap-14",
				reverse ? "desktop:grid-cols-[1.4fr_1fr]" : "desktop:grid-cols-[1fr_1.4fr]"
			)}
		>
			<Reveal className={cn(reverse && "desktop:order-2")}>
				<p className="font-semibold text-primary text-sm">{eyebrow}</p>
				<h3 className="mt-2 text-balance font-semibold text-2xl tracking-tight tablet:text-3xl">{title}</h3>
				<p className="mt-4 text-pretty text-muted-foreground leading-relaxed">{body}</p>
				<ul className="mt-6 space-y-3">
					{points.map((p) => (
						<li key={p} className="flex items-center gap-3">
							<span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
								<Check className="size-3.5" strokeWidth={3} />
							</span>
							{p}
						</li>
					))}
				</ul>
			</Reveal>
			<Reveal delay={0.15} y={40} className={cn("relative", reverse && "desktop:order-1")}>
				<div
					aria-hidden
					className="-z-10 absolute -inset-6 rounded-[2rem] opacity-70 blur-2xl"
					style={{ background: "radial-gradient(closest-side, color-mix(in oklab, var(--primary) 22%, transparent), transparent)" }}
				/>
				{picture}
			</Reveal>
		</div>
	);
}

/**
 * The public front page (plan: marketing). Server-rendered; the motion lives in small client
 * islands (`./motion`). Every claim on it is something the app does today.
 */
export async function LandingPage({ signedIn }: { signedIn: boolean }) {
	const t = await getTranslations("landing");
	const types = t.raw("types.items") as string[];
	const steps = t.raw("how.steps") as { title: string; body: string }[];
	const faqs = t.raw("faq.items") as { q: string; a: string }[];
	const heroPoints = t.raw("hero.points") as string[];
	const signupHref = signedIn ? "/dashboard" : "/register";
	const showDemo = env.demoEnabled && !signedIn;
	const plans = await getPublicPlans();

	return (
		<div className="relative flex min-h-svh flex-col overflow-x-clip bg-background">
			<LandingHeader signedIn={signedIn} />

			<main className="flex-1">
				{/* ------------------------------------------------------------------ hero */}
				<section className="relative isolate overflow-hidden px-4 pt-14 pb-20 tablet:px-6 desktop:pt-20">
					<HeroBackdrop />
					<div className="mx-auto max-w-6xl">
						<div className="mx-auto max-w-3xl text-center">
							<Reveal onLoad y={12}>
								<p className="inline-flex items-center gap-2 rounded-full bg-card px-3.5 py-1.5 font-medium text-sm shadow-sm ring-1 ring-foreground/8">
									<span className="relative flex size-1.5">
										<span className="absolute inset-0 animate-ping rounded-full bg-success opacity-60" />
										<span className="relative size-1.5 rounded-full bg-success" />
									</span>
									{t("hero.eyebrow")}
								</p>
							</Reveal>
							{/* No entrance animation: the headline is the page's largest paint, and one that starts
							    at opacity 0 waits for the JavaScript before it can count. */}
							<h1 className="mt-6 text-balance font-bold text-4xl leading-[1.15] tracking-tight tablet:text-5xl desktop:text-6xl">
								{t("hero.titleA")}
								<br />
								<span className="bg-linear-to-r from-[#635bff] via-[#7c6cff] to-[#0891b2] bg-clip-text text-transparent">
									{t("hero.titleB")}
								</span>
							</h1>
							<p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground leading-relaxed">
								{t("hero.subtitle")}
							</p>
							<Reveal onLoad delay={0.24} className="mt-8 flex flex-col justify-center gap-3 tablet:flex-row">
								<Button asChild size="lg" className="brand-gradient h-12 px-6 text-base">
									<Link href={signupHref}>
										{signedIn ? t("nav.app") : t("hero.primary")}
										<ArrowRight />
									</Link>
								</Button>
								{showDemo ? (
									<DemoDialog>
										<Button size="lg" variant="outline" className="h-12 bg-card px-6 text-base">
											{t("hero.demo")}
										</Button>
									</DemoDialog>
								) : (
									<Button asChild size="lg" variant="outline" className="h-12 bg-card px-6 text-base">
										<a href="#features">{t("hero.secondary")}</a>
									</Button>
								)}
							</Reveal>
							<Reveal onLoad delay={0.32}>
							<ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-muted-foreground text-sm">
								{heroPoints.map((p) => (
									<li key={p} className="flex items-center gap-1.5">
										<Check className="size-4 text-success" />
										{p}
									</li>
								))}
							</ul>
							</Reveal>
						</div>

						<div className="relative mx-auto mt-16 max-w-5xl">
							<TiltIn>
								<PosMockup />
							</TiltIn>
							<Float delay={1.1} className="-left-10 absolute top-20 hidden desktop:block">
								<SalesCard />
							</Float>
							<Float delay={1.3} distance={8} duration={7} className="-right-14 absolute top-[38%] hidden desktop:block">
								<ToastCards />
							</Float>
						</div>
					</div>
				</section>

				{/* ------------------------------------------------------------ shop types */}
				<section className="border-border/60 border-y bg-muted/30 px-4 py-10 tablet:px-6">
					<div className="mx-auto flex max-w-6xl flex-col items-center gap-6 desktop:flex-row desktop:justify-between">
						<p className="font-medium text-muted-foreground text-sm">{t("types.label")}</p>
						<Stagger as="ul" className="flex flex-wrap justify-center gap-x-8 gap-y-4">
							{types.map((label, i) => {
								const Icon = TYPE_ICONS[i] ?? Store;
								return (
									<StaggerItem as="li" key={label} className="flex items-center gap-2 font-medium text-foreground/80">
										<Icon className="size-5 text-primary" />
										{label}
									</StaggerItem>
								);
							})}
						</Stagger>
					</div>
				</section>

				{/* -------------------------------------------------------------- features */}
				<Section id="features">
					<SectionHeading
						eyebrow={t("features.eyebrow")}
						title={t("features.title")}
						subtitle={t("features.subtitle")}
					/>
					<Stagger className="mt-14 grid gap-4 tablet:grid-cols-2 desktop:grid-cols-3">
						{FEATURES.map(({ key, icon: Icon }) => (
							<StaggerItem
								key={key}
								className="group surface rounded-2xl p-6 transition-shadow duration-200 hover:shadow-lg"
							>
								<span className="brand-gradient flex size-11 items-center justify-center rounded-xl text-white shadow-sm transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
									<Icon className="size-5" />
								</span>
								<h3 className="mt-5 font-semibold text-lg">{t(`features.items.${key}.title`)}</h3>
								<p className="mt-2 text-muted-foreground leading-relaxed">{t(`features.items.${key}.body`)}</p>
							</StaggerItem>
						))}
					</Stagger>
				</Section>

				{/* ----------------------------------------------------------- how it works */}
				<Section id="how" className="bg-muted/30">
					<SectionHeading eyebrow={t("how.eyebrow")} title={t("how.title")} />
					<Stagger as="ol" className="relative mt-14 grid gap-6 desktop:grid-cols-3">
						<span
							aria-hidden
							className="absolute top-7 right-[16%] left-[16%] hidden h-px bg-linear-to-r from-transparent via-border to-transparent desktop:block"
						/>
						{steps.map((step, i) => (
							<StaggerItem as="li" key={step.title} className="relative text-center">
								<span className="numeric relative mx-auto flex size-14 items-center justify-center rounded-2xl bg-card font-bold text-primary text-xl shadow-md ring-1 ring-foreground/8">
									{i + 1}
								</span>
								<h3 className="mt-5 font-semibold text-lg">{step.title}</h3>
								<p className="mx-auto mt-2 max-w-xs text-muted-foreground">{step.body}</p>
							</StaggerItem>
						))}
					</Stagger>
				</Section>

				{/* -------------------------------------------------------------- showcase */}
				<Section className="space-y-24 desktop:space-y-32">
					<Showcase
						eyebrow={t("showcase.pos.eyebrow")}
						title={t("showcase.pos.title")}
						body={t("showcase.pos.body")}
						points={t.raw("showcase.pos.points") as string[]}
						picture={<PosMockup />}
					/>
					<div className="mt-24 desktop:mt-32">
						<Showcase
							reverse
							eyebrow={t("showcase.reports.eyebrow")}
							title={t("showcase.reports.title")}
							body={t("showcase.reports.body")}
							points={t.raw("showcase.reports.points") as string[]}
							picture={<DashboardMockup />}
						/>
					</div>
				</Section>

				{/* --------------------------------------------------------------- pricing */}
				{/* No prices at all beats wrong ones: the section waits for the API's list. */}
				{plans?.length ? (
					<>
				<Section id="pricing" className="bg-muted/30">
					<SectionHeading eyebrow={t("pricing.eyebrow")} title={t("pricing.title")} subtitle={t("pricing.subtitle")} />
					<Stagger className="mt-14 grid gap-4 tablet:grid-cols-2 desktop:grid-cols-4">
						{(plans ?? []).map((plan) => {
							const featured = plan.code === "PRO";
							return (
								<StaggerItem
									key={plan.code}
									className={cn(
										"relative flex flex-col rounded-2xl p-6",
										featured
											? "bg-card shadow-xl ring-2 ring-primary desktop:-my-3 desktop:py-9"
											: "surface"
									)}
								>
									{featured ? (
										<span className="brand-gradient -top-3 absolute left-6 rounded-full px-3 py-1 font-semibold text-white text-xs">
											{t("pricing.popular")}
										</span>
									) : null}
									<h3 className="font-semibold text-lg">{plan.name}</h3>
									<p className="mt-3 flex items-baseline gap-1">
										<span className="numeric font-bold text-4xl tracking-tight">
											{plan.monthlyPrice === 0 ? t("pricing.free") : formatBaht(plan.monthlyPrice)}
										</span>
										{plan.monthlyPrice === 0 ? null : (
											<span className="text-muted-foreground text-sm">{t("pricing.perMonth")}</span>
										)}
									</p>
									<ul className="mt-6 flex-1 space-y-2.5 text-sm">
										{plan.highlights.map((h) => (
											<li
												key={h.label}
												className={cn("flex items-start gap-2.5", h.soon && "text-muted-foreground")}
											>
												{h.soon ? (
													<Clock3 className="mt-0.5 size-4 shrink-0" />
												) : (
													<Check className="mt-0.5 size-4 shrink-0 text-success" />
												)}
												<span>
													{h.label}
													{h.soon ? (
														<span className="ml-1.5 whitespace-nowrap rounded-full bg-muted px-1.5 py-0.5 font-medium text-[11px]">
															{t("pricing.soon")}
														</span>
													) : null}
												</span>
											</li>
										))}
									</ul>
									<Button
										asChild
										size="lg"
										variant={featured ? "default" : "outline"}
										className={cn("mt-8 w-full", featured ? "brand-gradient" : "bg-card")}
									>
										<Link href={signupHref}>{plan.monthlyPrice === 0 ? t("pricing.ctaFree") : t("pricing.cta")}</Link>
									</Button>
								</StaggerItem>
							);
						})}
					</Stagger>
				</Section>
					</>
				) : null}

				{/* ------------------------------------------------------------------- faq */}
				<Section id="faq">
					<div className="grid gap-10 desktop:grid-cols-[1fr_1.4fr] desktop:gap-16">
						<Reveal>
							<p className="font-semibold text-primary text-sm">{t("faq.eyebrow")}</p>
							<h2 className="mt-2 text-balance font-semibold text-3xl tracking-tight tablet:text-4xl">{t("faq.title")}</h2>
						</Reveal>
						<Reveal delay={0.1}>
						<Accordion type="single" collapsible className="surface rounded-2xl px-6">
							{faqs.map((f, i) => (
								<AccordionItem key={f.q} value={`q${i}`} className="border-border/60">
									<AccordionTrigger className="py-5 text-left font-medium text-base hover:no-underline">
										{f.q}
									</AccordionTrigger>
									<AccordionContent className="pb-5 text-muted-foreground leading-relaxed">{f.a}</AccordionContent>
								</AccordionItem>
							))}
						</Accordion>
						</Reveal>
					</div>
				</Section>

				{/* ----------------------------------------------------------- closing cta */}
				<section className="px-4 pb-20 tablet:px-6">
					<Reveal y={40}>
					<div className="hero-surface relative mx-auto max-w-6xl overflow-hidden rounded-3xl px-6 py-16 text-center text-white tablet:px-12">
						<div
							aria-hidden
							className="absolute inset-0 opacity-60"
							style={{
								backgroundImage: "radial-gradient(oklch(1 0 0 / 0.14) 1px, transparent 1px)",
								backgroundSize: "18px 18px",
								maskImage: "radial-gradient(ellipse 60% 70% at 50% 50%, black, transparent)",
							}}
						/>
						<div className="relative">
							<h2 className="text-balance font-semibold text-3xl tracking-tight tablet:text-4xl">{t("cta.title")}</h2>
							<p className="mx-auto mt-4 max-w-xl text-lg text-white/75">{t("cta.body")}</p>
							<div className="mt-8 flex flex-col justify-center gap-3 tablet:flex-row">
								<Button asChild size="lg" className="h-12 bg-white px-6 text-base text-[#1e1b4b] hover:bg-white/90">
									<Link href={signupHref}>
										{signedIn ? t("nav.app") : t("cta.primary")}
										<ArrowRight />
									</Link>
								</Button>
								{showDemo ? (
									<DemoDialog>
										<Button
											size="lg"
											variant="outline"
											className="h-12 border-white/40 bg-transparent px-6 text-base text-white hover:bg-white/10 hover:text-white"
										>
											{t("cta.demo")}
										</Button>
									</DemoDialog>
								) : null}
								{signedIn ? null : (
									<Button
										asChild
										size="lg"
										variant="ghost"
										className="h-12 px-6 text-base text-white hover:bg-white/10 hover:text-white"
									>
										<Link href="/login">{t("cta.secondary")}</Link>
									</Button>
								)}
							</div>
						</div>
					</div>
					</Reveal>
				</section>
			</main>

			{/* ---------------------------------------------------------------- footer */}
			<footer className="border-border/60 border-t px-4 py-12 tablet:px-6">
				<div className="mx-auto grid max-w-6xl gap-10 tablet:grid-cols-[2fr_1fr_1fr]">
					<div>
						<div className="flex items-center gap-2.5">
							<BrandMark />
							<span className="font-semibold text-lg">Posly</span>
						</div>
						<p className="mt-3 max-w-xs text-muted-foreground text-sm">{t("footer.tagline")}</p>
					</div>
					<div>
						<p className="font-semibold text-sm">{t("footer.product")}</p>
						<ul className="mt-3 space-y-2 text-muted-foreground text-sm">
							{(["features", "pricing", "faq"] as const).map((k) => (
								<li key={k}>
									<a href={`#${k}`} className="hover:text-foreground">
										{t(`nav.${k}`)}
									</a>
								</li>
							))}
						</ul>
					</div>
					<div>
						<p className="font-semibold text-sm">{t("footer.account")}</p>
						<ul className="mt-3 space-y-2 text-muted-foreground text-sm">
							<li>
								<Link href="/login" className="hover:text-foreground">
									{t("nav.login")}
								</Link>
							</li>
							<li>
								<Link href="/register" className="hover:text-foreground">
									{t("nav.signup")}
								</Link>
							</li>
						</ul>
					</div>
				</div>
				<p className="mx-auto mt-10 max-w-6xl text-muted-foreground text-xs">
					{t("footer.rights", { year: new Date().getFullYear() })}
				</p>
			</footer>
		</div>
	);
}
