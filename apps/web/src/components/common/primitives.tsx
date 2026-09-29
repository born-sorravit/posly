import { Badge } from "@posly/ui/components/badge";
import { Skeleton } from "@posly/ui/components/skeleton";
import { formatBaht, type Satang } from "@posly/utils/money";
import { formatPercent } from "@posly/utils/format";
import { cn } from "@/lib/utils";
import type { Tone } from "@posly/types/domain";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

/**
 * The small shared vocabulary every page is built from (plan §49). Pages compose these; they
 * do not restyle them.
 */

export function PageHeader({
	title,
	description,
	actions,
	className,
}: {
	title: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex flex-col gap-3 tablet:flex-row tablet:items-end tablet:justify-between",
				className
			)}
		>
			<div className="min-w-0 space-y-1">
				<h1 className="font-semibold text-2xl tracking-tight">{title}</h1>
				{description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
			</div>
			{actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
		</div>
	);
}

/** Page body width and rhythm, shared so every screen lines up with every other. */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
	return (
		<div className={cn("mx-auto w-full max-w-7xl space-y-6 px-4 py-6 desktop:px-8 desktop:py-8", className)}>
			{children}
		</div>
	);
}

/** A white surface on the tinted page. Soft shadow, no hard border (plan: no border-on-everything). */
export function Surface({
	children,
	className,
	as: Tag = "section",
	"data-tour": tour,
}: {
	children: ReactNode;
	className?: string;
	as?: "section" | "div" | "article";
	/** Anchor for a page tour step. */
	"data-tour"?: string;
}) {
	return (
		<Tag className={cn("surface rounded-2xl p-5", className)} data-tour={tour}>
			{children}
		</Tag>
	);
}

export function SectionTitle({
	children,
	action,
	className,
}: {
	children: ReactNode;
	action?: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("mb-4 flex items-center justify-between gap-3", className)}>
			<h2 className="font-semibold text-base">{children}</h2>
			{action}
		</div>
	);
}

export function MoneyDisplay({
	amount,
	className,
	signed,
}: {
	amount: Satang;
	className?: string;
	signed?: boolean;
}) {
	return <span className={cn("numeric", className)}>{formatBaht(amount, { signed })}</span>;
}

/** +14.2% / −3.1% versus the comparison period. Up is green, down is red, flat is muted. */
export function StatTrend({
	change,
	label,
	className,
}: {
	change: number;
	label?: string;
	className?: string;
}) {
	const up = change > 0;
	const flat = change === 0;
	const Icon = up ? ArrowUpRight : ArrowDownRight;
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 font-medium text-xs",
				flat ? "text-muted-foreground" : up ? "text-success" : "text-danger",
				className
			)}
		>
			{flat ? null : <Icon className="size-3.5" />}
			<span className="numeric">{formatPercent(change)}</span>
			{label ? <span className="font-normal text-muted-foreground">{label}</span> : null}
		</span>
	);
}

const TONE_VAR: Record<Tone, string> = {
	primary: "var(--primary)",
	success: "var(--success)",
	warning: "var(--warning)",
	danger: "var(--danger)",
	info: "var(--chart-4)",
};

export const toneStyle = (tone: Tone) => ({ "--tint": TONE_VAR[tone] }) as CSSProperties;

export function IconChip({
	icon: Icon,
	tone = "primary",
	className,
}: {
	icon: LucideIcon;
	tone?: Tone;
	className?: string;
}) {
	return (
		<span
			className={cn("tint-chip flex size-10 shrink-0 items-center justify-center rounded-xl", className)}
			style={toneStyle(tone)}
		>
			<Icon className="size-5" />
		</span>
	);
}

/**
 * A tiny trend line under a headline number. One series, no axes, no labels — the number
 * above it is the reading; this only says "rising" or "falling" at a glance.
 */
export function Sparkline({
	values,
	tone = "primary",
	className,
}: {
	values: number[];
	tone?: Tone;
	className?: string;
}) {
	if (values.length < 2) return null;
	const max = Math.max(...values);
	const min = Math.min(...values);
	const span = max - min || 1;
	const points = values.map((v, i) => [
		(i / (values.length - 1)) * 100,
		28 - ((v - min) / span) * 24,
	]);
	const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
	const id = `spark-${tone}`;
	return (
		<svg viewBox="0 0 100 30" preserveAspectRatio="none" className={cn("h-8 w-full", className)} aria-hidden style={toneStyle(tone)}>
			<defs>
				<linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor="var(--tint)" stopOpacity="0.28" />
					<stop offset="100%" stopColor="var(--tint)" stopOpacity="0" />
				</linearGradient>
			</defs>
			<path d={`${line} L100,30 L0,30 Z`} fill={`url(#${id})`} />
			<path d={line} fill="none" stroke="var(--tint)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
		</svg>
	);
}

/**
 * A headline number. `tinted` gives it the soft wash of the reference dashboard; plain is
 * for secondary rows where four tints would be noise.
 */
export function MetricCard({
	label,
	value,
	icon,
	tone = "primary",
	change,
	changeLabel,
	tinted = false,
	trend,
	className,
}: {
	/** Optional series drawn as a sparkline under the number. */
	trend?: number[];
	label: ReactNode;
	value: ReactNode;
	icon: LucideIcon;
	tone?: Tone;
	/** Null = no comparison available (the previous period had nothing). */
	change?: number | null;
	changeLabel?: string;
	tinted?: boolean;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex flex-col gap-3 rounded-2xl p-5",
				tinted ? "tint-surface" : "surface",
				className
			)}
			style={tinted ? toneStyle(tone) : undefined}
		>
			<div className="flex items-center gap-3">
				<IconChip icon={icon} tone={tone} className="size-9 rounded-lg" />
				<span className="font-medium text-muted-foreground text-sm">{label}</span>
			</div>
			<div className="numeric font-semibold text-[28px] leading-none tracking-tight">{value}</div>
			{change !== undefined && change !== null ? <StatTrend change={change} label={changeLabel} /> : null}
			{trend ? <Sparkline values={trend} tone={tone} className="-mx-1 -mb-1 mt-auto" /> : null}
		</div>
	);
}

const BADGE_TONE: Record<Tone | "neutral", string> = {
	primary: "bg-primary/10 text-primary",
	success: "bg-success/12 text-success",
	warning: "bg-warning/15 text-amber-700 dark:text-warning",
	danger: "bg-danger/10 text-danger",
	info: "bg-chart-4/12 text-sky-700 dark:text-chart-4",
	neutral: "bg-muted text-muted-foreground",
};

export function StatusBadge({
	tone,
	children,
	dot = false,
	className,
}: {
	tone: Tone | "neutral";
	children: ReactNode;
	dot?: boolean;
	className?: string;
}) {
	return (
		<Badge className={cn("h-6 rounded-lg px-2 font-medium", BADGE_TONE[tone], className)}>
			{dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
			{children}
		</Badge>
	);
}

/**
 * Never an empty table (plan §30): what is missing, why it matters, and the one thing to do
 * about it.
 */
export function EmptyState({
	icon: Icon,
	title,
	description,
	action,
	className,
}: {
	icon: LucideIcon;
	title: ReactNode;
	description?: ReactNode;
	action?: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center gap-4 rounded-2xl px-6 py-16 text-center",
				className
			)}
		>
			<span className="relative flex size-16 items-center justify-center rounded-2xl bg-accent text-primary">
				<Icon className="size-7" strokeWidth={1.75} />
				<span className="absolute -inset-2 -z-10 rounded-3xl bg-accent/50 blur-md" aria-hidden />
			</span>
			<div className="max-w-sm space-y-1">
				<p className="font-semibold text-base">{title}</p>
				{description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
			</div>
			{action}
		</div>
	);
}

/** Skeletons shaped like what they stand in for (plan §31) — never a centred spinner. */
export function MetricSkeleton() {
	return (
		<div className="surface space-y-3 rounded-2xl p-5">
			<div className="flex items-center gap-3">
				<Skeleton className="size-9 rounded-lg" />
				<Skeleton className="h-4 w-24" />
			</div>
			<Skeleton className="h-7 w-32" />
			<Skeleton className="h-3 w-20" />
		</div>
	);
}

export function ChartSkeleton({ className }: { className?: string }) {
	return (
		<div className={cn("surface space-y-4 rounded-2xl p-5", className)}>
			<Skeleton className="h-5 w-40" />
			<div className="flex h-56 items-end gap-2">
				{[40, 65, 50, 80, 70, 90, 60, 75].map((h, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder bars; heights may repeat
					<Skeleton key={i} className="flex-1 rounded-md" style={{ height: `${h}%` }} />
				))}
			</div>
		</div>
	);
}

export function ProductCardSkeleton() {
	return (
		<div className="surface space-y-2 rounded-2xl p-2">
			<Skeleton className="aspect-[4/3] w-full rounded-xl" />
			<Skeleton className="h-4 w-3/4" />
			<Skeleton className="h-4 w-1/3" />
		</div>
	);
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
	return (
		<div className="space-y-3 p-2">
			{Array.from({ length: rows }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
				<div key={i} className="flex items-center gap-4">
					<Skeleton className="size-9 rounded-lg" />
					<Skeleton className="h-4 flex-1" />
					<Skeleton className="h-4 w-20" />
					<Skeleton className="h-4 w-16" />
				</div>
			))}
		</div>
	);
}
