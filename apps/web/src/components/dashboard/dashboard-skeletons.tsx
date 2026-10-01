import { toneStyle } from "@/components/common/primitives";
import { TextSkeleton, range } from "@/components/common/skeleton-text";
import { cn } from "@/lib/utils";
import type { Tone } from "@posly/types/domain";
import { Skeleton } from "@posly/ui/components/skeleton";

/*
 * The dashboard's loading shapes, one per block, used by the route's loading.tsx and by the
 * overview while its query is pending — so neither step moves anything. Server-safe.
 */

/** A bar on the dark hero: white wash instead of the grey muted skeleton. */
const onHero = "bg-white/10";

/** Section heading row (`SectionTitle`): a `text-base` title, optionally a "see all" link. */
function TitleSkeleton({ className, link = false }: { className?: string; link?: boolean }) {
	return (
		<div className="mb-4 flex items-center justify-between gap-3">
			<TextSkeleton box="h-6" bar="h-4" className={className} />
			{link ? <Skeleton className="h-3 w-14" /> : null}
		</div>
	);
}

/** The phone's big figure under the greeting: label, today's sales, trend and orders, yesterday. */
export function HeroFigureSkeleton() {
	return (
		<div className="relative mt-6 tablet:hidden" aria-hidden>
			<TextSkeleton className={cn("w-24", onHero)} />
			<TextSkeleton box="h-10" bar="h-8" className={cn("w-40", onHero)} />
			<div className="mt-1 flex h-5 items-center gap-3">
				<Skeleton className={cn("h-3 w-12", onHero)} />
				<Skeleton className={cn("h-3.5 w-16", onHero)} />
			</div>
			<TextSkeleton box="mt-0.5 h-4" bar="h-3" className={cn("w-36", onHero)} />
		</div>
	);
}

/** The greeting card itself, dark in both themes like the real one, with the date and period select. */
export function HeroSkeleton() {
	return (
		<section
			className="hero-surface relative overflow-hidden rounded-3xl px-6 py-7 text-white tablet:px-8 tablet:py-8"
			aria-hidden
		>
			<div className="hero-grid pointer-events-none absolute inset-0" />
			<div className="relative flex flex-col gap-4 tablet:flex-row tablet:items-end tablet:justify-between">
				<div className="space-y-1">
					<TextSkeleton box="h-8 tablet:h-9" bar="h-6 tablet:h-7" className={cn("w-48 tablet:w-56", onHero)} />
					<TextSkeleton box="h-[1.6rem]" bar="h-4" className={cn("w-32", onHero)} />
				</div>
				<div className="flex items-center gap-2">
					<Skeleton className={cn("h-3.5 w-28", onHero)} />
					<Skeleton className={cn("h-9 w-28 rounded-xl", onHero)} />
				</div>
			</div>
			<HeroFigureSkeleton />
		</section>
	);
}

/**
 * One tinted `MetricCard`: icon chip and label, the figure, the change pill over the comparison
 * line, then the sparkline. Tightens below tablet like the card does.
 */
export function MetricCardSkeleton({ tone, className }: { tone: Tone; className?: string }) {
	return (
		<div
			className={cn(
				"tint-surface flex min-w-0 flex-col gap-2.5 rounded-2xl p-4 tablet:gap-3 tablet:p-5",
				className
			)}
			style={toneStyle(tone)}
		>
			<div className="flex items-center gap-2.5 tablet:gap-3">
				<Skeleton className="size-8 shrink-0 rounded-lg tablet:size-9" />
				<Skeleton className="h-3 w-20 tablet:h-3.5 tablet:w-24" />
			</div>
			<TextSkeleton box="h-[25px] tablet:h-7" bar="h-5 tablet:h-6" className="w-24 tablet:w-32" />
			<div className="flex flex-col items-start gap-1.5">
				<Skeleton className="h-5 w-14 rounded-md" />
				<TextSkeleton box="h-4" bar="h-3" className="w-28" />
			</div>
			<Skeleton className="-mx-1 -mb-1 mt-auto h-8 rounded-md opacity-60" />
		</div>
	);
}

/**
 * The four headline cards. On a phone the hero already shows revenue, so that card is hidden
 * and profit spans the row — three cards, as the page renders them.
 */
export function DashboardMetricsSkeleton() {
	return (
		<div className="grid grid-cols-2 gap-3 desktop:grid-cols-4 desktop:gap-4" aria-hidden>
			<MetricCardSkeleton tone="success" className="hidden tablet:flex" />
			<MetricCardSkeleton tone="primary" />
			<MetricCardSkeleton tone="info" />
			<MetricCardSkeleton tone="warning" className="col-span-2 tablet:col-span-1" />
		</div>
	);
}

/**
 * `SalesChart`: title and the preset switcher, the legend line, then the plot at the chart's
 * own height with its y-axis labels and x ticks.
 */
export function SalesChartSkeleton({
	className,
	height = 260,
	presets = true,
}: {
	className?: string;
	height?: number;
	/** The today / 7 days / 30 days switcher; absent for a custom range. */
	presets?: boolean;
}) {
	return (
		<div className={cn("surface rounded-2xl p-5", className)} aria-hidden>
			<div className="mb-4 flex items-center justify-between gap-3">
				<TextSkeleton box="h-6" bar="h-4" className="w-28" />
				{presets ? <Skeleton className="h-8 w-40 rounded-lg" /> : null}
			</div>
			<div className="-mt-2 mb-3 flex h-4 items-center gap-3">
				<Skeleton className="h-3 w-24" />
				<Skeleton className="h-3 w-36" />
			</div>
			<div style={{ height }} className="-ml-2 flex gap-2">
				<div className="flex w-[44px] shrink-0 flex-col items-end justify-between pt-1 pb-8">
					{range(5).map((i) => (
						<Skeleton key={i} className="h-3 w-8" />
					))}
				</div>
				<div className="flex min-w-0 flex-1 flex-col">
					<div className="relative min-h-0 flex-1 border-border border-b">
						<svg
							viewBox="0 0 100 40"
							preserveAspectRatio="none"
							className="absolute inset-0 size-full animate-pulse fill-muted"
						>
							<path d="M0,30 C10,27 18,15 30,19 S50,31 62,17 S84,7 100,13 L100,40 L0,40 Z" />
						</svg>
					</div>
					<div className="flex h-7 items-center justify-between">
						{range(6).map((i) => (
							<Skeleton key={i} className="h-3 w-8" />
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

/** `TopProducts`: rank, thumbnail, name, units sold and revenue for five rows. */
export function TopProductsSkeleton({ className, rows = 5 }: { className?: string; rows?: number }) {
	return (
		<div className={cn("surface rounded-2xl p-5", className)} aria-hidden>
			<TitleSkeleton className="w-24" link />
			<div className="grid gap-1">
				{range(rows).map((i) => (
					<div key={i} className="flex items-center gap-3 py-1.5">
						<span className="flex w-4 justify-center">
							<Skeleton className="h-3.5 w-2.5" />
						</span>
						<Skeleton className="size-9 shrink-0 rounded-lg" />
						<span className="min-w-0 flex-1">
							<Skeleton className="h-3.5" style={{ width: `${[62, 48, 70, 54, 40][i % 5]}%` }} />
						</span>
						<span className="flex w-16 justify-end">
							<Skeleton className="h-3.5 w-10" />
						</span>
						<span className="flex w-20 justify-end">
							<Skeleton className="h-3.5 w-14" />
						</span>
					</div>
				))}
			</div>
		</div>
	);
}

/** `PaymentBreakdown`: the donut, then one legend row per method (beside it from tablet up). */
export function PaymentBreakdownSkeleton({ className }: { className?: string }) {
	return (
		<div className={cn("surface rounded-2xl p-5", className)} aria-hidden>
			<TitleSkeleton className="w-32" />
			<div className="flex flex-col items-center gap-5 tablet:flex-row">
				<div className="relative size-36 shrink-0">
					<Skeleton className="size-full rounded-full" />
					{/* The hole: the chart's inner radius is 68% of the outer. */}
					<div className="absolute inset-[16%] rounded-full bg-card" />
				</div>
				<div className="grid w-full gap-2.5">
					{range(3).map((i) => (
						<div key={i} className="flex h-5 items-center gap-2.5">
							<Skeleton className="size-2.5 shrink-0 rounded-full" />
							<Skeleton className="size-4 shrink-0 rounded" />
							<span className="min-w-0 flex-1">
								<Skeleton className="h-3.5" style={{ width: `${[36, 48, 30][i]}%` }} />
							</span>
							<span className="flex w-10 justify-end">
								<Skeleton className="h-3.5 w-7" />
							</span>
							<span className="flex w-20 justify-end">
								<Skeleton className="h-3.5 w-16" />
							</span>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

/** `StockAlerts`: tinted rows with the tone chip, name, what is left and the label. */
export function StockAlertsSkeleton({ className, rows = 3 }: { className?: string; rows?: number }) {
	return (
		<div className={cn("surface rounded-2xl p-5", className)} aria-hidden>
			<TitleSkeleton className="w-28" link />
			<div className="grid gap-2">
				{range(rows).map((i) => (
					<div key={i} className="flex items-center gap-3 rounded-xl bg-muted/60 p-3">
						<Skeleton className="size-9 shrink-0 rounded-lg bg-foreground/10" />
						<div className="min-w-0 flex-1">
							<TextSkeleton className="bg-foreground/10" style={{ width: `${[52, 40, 60][i % 3]}%` }} />
							<TextSkeleton box="h-4" bar="h-3" className="w-20 bg-foreground/10" />
						</div>
						<Skeleton className="h-3 w-12 bg-foreground/10" />
					</div>
				))}
			</div>
		</div>
	);
}

/** Everything under the hero: the metrics, chart beside top products, payments beside alerts. */
export function DashboardBodySkeleton() {
	return (
		<>
			<DashboardMetricsSkeleton />
			<div className="grid gap-4 desktop:grid-cols-5">
				<SalesChartSkeleton className="desktop:col-span-3" />
				<TopProductsSkeleton className="desktop:col-span-2" />
			</div>
			<div className="grid gap-4 desktop:grid-cols-5">
				<PaymentBreakdownSkeleton className="desktop:col-span-3" />
				<StockAlertsSkeleton className="desktop:col-span-2" />
			</div>
		</>
	);
}
