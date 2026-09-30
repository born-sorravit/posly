"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@posly/ui/components/badge";
import { Button } from "@posly/ui/components/button";
import { Skeleton } from "@posly/ui/components/skeleton";
import type { Tone } from "@posly/types/domain";
import { ChevronLeft, ChevronRight, Inbox, type LucideIcon, RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { type CSSProperties, type ReactNode, useId } from "react";

/*
 * The same vocabulary as apps/web/src/components/common/primitives.tsx (PageHeader, the
 * tinted MetricCard with its IconChip and Sparkline, StatusBadge, EmptyState), so the two
 * apps read as one product. Keep them in step when either changes.
 */

export function PageHeader({
	title,
	description,
	actions,
}: {
	title: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
}) {
	return (
		<div className="flex flex-col gap-3 tablet:flex-row tablet:items-end tablet:justify-between">
			<div className="min-w-0 space-y-1">
				<h1 className="font-semibold text-2xl tracking-tight">{title}</h1>
				{description ? <div className="text-muted-foreground text-sm">{description}</div> : null}
			</div>
			{actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
		</div>
	);
}

export function Surface({ className, children }: { className?: string; children: ReactNode }) {
	return <section className={cn("surface min-w-0 rounded-2xl", className)}>{children}</section>;
}

/** The heading row of a card: `section` style, with the card's own padding. */
export function SectionTitle({ title, hint, action }: { title: ReactNode; hint?: ReactNode; action?: ReactNode }) {
	return (
		<div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4">
			<div className="min-w-0">
				<h2 className="font-semibold text-base">{title}</h2>
				{hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
			</div>
			{action}
		</div>
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

export function IconChip({ icon: Icon, tone = "primary", className }: { icon: LucideIcon; tone?: Tone; className?: string }) {
	return (
		<span
			className={cn("tint-chip flex size-10 shrink-0 items-center justify-center rounded-xl", className)}
			style={toneStyle(tone)}
		>
			<Icon className="size-5" />
		</span>
	);
}

/** A tiny trend line under a headline number: one series, no axes. */
export function Sparkline({ values, tone = "primary", className }: { values: number[]; tone?: Tone; className?: string }) {
	const id = useId();
	if (values.length < 2) return null;
	const max = Math.max(...values);
	const min = Math.min(...values);
	const span = max - min || 1;
	const points = values.map((v, i) => [(i / (values.length - 1)) * 100, 28 - ((v - min) / span) * 24]);
	const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
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
 * A headline number, as apps/web's MetricCard: `tinted` gives the soft wash used for the
 * lead figures; plain is for secondary rows where more tints would be noise.
 */
export function StatCard({
	label,
	value,
	hint,
	icon,
	tone = "primary",
	tinted = false,
	trend,
	loading,
	className,
}: {
	className?: string;
	label: ReactNode;
	value: ReactNode;
	hint?: ReactNode;
	icon: LucideIcon;
	tone?: Tone;
	tinted?: boolean;
	trend?: number[];
	loading?: boolean;
}) {
	return (
		<div
			className={cn(
				"flex min-w-0 flex-col gap-2.5 rounded-2xl p-4 tablet:gap-3 tablet:p-5",
				tinted ? "tint-surface" : "surface",
				className
			)}
			style={tinted ? toneStyle(tone) : undefined}
		>
			<div className="flex items-center gap-2.5 tablet:gap-3">
				<IconChip icon={icon} tone={tone} className="size-8 rounded-lg tablet:size-9 [&_svg]:size-4 tablet:[&_svg]:size-5" />
				<span className="min-w-0 font-medium text-muted-foreground text-xs leading-snug tablet:text-sm">{label}</span>
			</div>
			{loading ? (
				<Skeleton className="h-7 w-28" />
			) : (
				<div className="numeric truncate font-semibold text-xl leading-tight tracking-tight tablet:text-[28px] tablet:leading-none">
					{value}
				</div>
			)}
			{hint && !loading ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
			{trend && !loading ? <Sparkline values={trend} tone={tone} className="-mx-1 -mb-1 mt-auto" /> : null}
		</div>
	);
}

/** Never an empty table: what is missing, and why. Same look as apps/web's EmptyState. */
export function EmptyState({
	icon: Icon = Inbox,
	title,
	description,
}: {
	icon?: LucideIcon;
	title: string;
	description?: string;
}) {
	return (
		<div className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
			<span className="relative flex size-14 items-center justify-center rounded-2xl bg-accent text-primary">
				<Icon className="size-6" strokeWidth={1.75} />
			</span>
			<div className="max-w-sm space-y-1">
				<p className="font-semibold text-base">{title}</p>
				{description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
			</div>
		</div>
	);
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
	return (
		<div className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
			<span className="flex size-14 items-center justify-center rounded-2xl bg-danger/10 text-danger">
				<TriangleAlert className="size-6" strokeWidth={1.75} />
			</span>
			<div className="max-w-sm space-y-1">
				<p className="font-semibold text-base">โหลดข้อมูลไม่สำเร็จ</p>
				<p className="text-muted-foreground text-sm">{error instanceof Error ? error.message : "เกิดข้อผิดพลาด"}</p>
			</div>
			{retry ? (
				<Button size="lg" onClick={retry}>
					<RotateCcw />
					ลองอีกครั้ง
				</Button>
			) : null}
		</div>
	);
}

export function RowsSkeleton({ rows = 6 }: { rows?: number }) {
	return (
		<div className="grid gap-2 p-5">
			{Array.from({ length: rows }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
				<Skeleton key={i} className="h-9 w-full" />
			))}
		</div>
	);
}

type BadgeTone = Tone | "neutral";

/** Same tints as apps/web's StatusBadge, so a status reads identically in both apps. */
const BADGE_TONE: Record<BadgeTone, string> = {
	primary: "bg-primary/10 text-primary",
	success: "bg-success/12 text-success",
	warning: "bg-warning/15 text-amber-700 dark:text-warning",
	danger: "bg-danger/10 text-danger",
	info: "bg-chart-4/12 text-sky-700 dark:text-chart-4",
	neutral: "bg-muted text-muted-foreground",
};

/** Status always carries its label; colour only reinforces it. */
export function StatusBadge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
	return <Badge className={cn("h-6 rounded-lg px-2 font-medium", BADGE_TONE[tone])}>{children}</Badge>;
}

export function Pager({
	page,
	lastPage,
	total,
	onPage,
}: {
	page: number;
	lastPage: number;
	total: number;
	onPage: (page: number) => void;
}) {
	return (
		<div className="flex items-center justify-between gap-3 border-t px-5 py-3 text-muted-foreground text-sm">
			<span className="numeric">ทั้งหมด {total.toLocaleString("th-TH")} รายการ</span>
			<div className="flex items-center gap-2">
				<Button
					variant="outline"
					size="icon-sm"
					aria-label="หน้าก่อน"
					disabled={page <= 1}
					onClick={() => onPage(page - 1)}
				>
					<ChevronLeft />
				</Button>
				<span className="numeric">
					{lastPage === 0 ? 0 : page} / {lastPage}
				</span>
				<Button
					variant="outline"
					size="icon-sm"
					aria-label="หน้าถัดไป"
					disabled={page >= lastPage}
					onClick={() => onPage(page + 1)}
				>
					<ChevronRight />
				</Button>
			</div>
		</div>
	);
}

/**
 * The phone form of a table (DESIGN.md: tables become rows below `tablet`). Render it beside
 * a `DesktopOnly` table with the same data.
 */
export function MobileList({ children }: { children: ReactNode }) {
	return <ul className="divide-y tablet:hidden">{children}</ul>;
}

export function MobileRow({
	title,
	meta,
	aside,
	href,
}: {
	title: ReactNode;
	meta?: ReactNode;
	aside?: ReactNode;
	href?: string;
}) {
	const body = (
		<>
			<div className="min-w-0 flex-1">
				<div className="flex min-w-0 items-center gap-2 font-medium text-sm">{title}</div>
				{meta ? <div className="mt-0.5 truncate text-muted-foreground text-xs">{meta}</div> : null}
			</div>
			{aside ? <div className="shrink-0 text-right text-sm">{aside}</div> : null}
		</>
	);
	return (
		<li>
			{href ? (
				<Link href={href} className="flex min-h-14 items-center gap-3 px-4 py-3 active:bg-muted">
					{body}
				</Link>
			) : (
				<div className="flex min-h-14 items-center gap-3 px-4 py-3">{body}</div>
			)}
		</li>
	);
}

export function DesktopOnly({ children }: { children: ReactNode }) {
	return <div className="hidden tablet:block">{children}</div>;
}
