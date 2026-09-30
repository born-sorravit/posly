"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@posly/ui/components/badge";
import { Button } from "@posly/ui/components/button";
import { Skeleton } from "@posly/ui/components/skeleton";
import { ChevronLeft, ChevronRight, type LucideIcon, RotateCcw, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({
	title,
	description,
	actions,
}: {
	title: string;
	description?: ReactNode;
	actions?: ReactNode;
}) {
	return (
		<div className="flex flex-wrap items-end justify-between gap-4">
			<div className="min-w-0">
				<h1 className="font-semibold text-2xl tracking-tight">{title}</h1>
				{description ? <p className="mt-1 text-muted-foreground text-sm">{description}</p> : null}
			</div>
			{actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
		</div>
	);
}

export function Surface({ className, children }: { className?: string; children: ReactNode }) {
	// min-w-0 lets a wide table scroll inside the card instead of widening the page.
	return <section className={cn("surface min-w-0 rounded-2xl", className)}>{children}</section>;
}

export function SectionTitle({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
	return (
		<div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
			<div>
				<h2 className="font-semibold text-base">{title}</h2>
				{hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
			</div>
			{action}
		</div>
	);
}

/** One headline number. Not a chart: a single value reads best as a number. */
export function StatCard({
	label,
	value,
	hint,
	icon: Icon,
	loading,
}: {
	label: string;
	value: ReactNode;
	hint?: ReactNode;
	icon?: LucideIcon;
	loading?: boolean;
}) {
	return (
		<Surface className="p-5">
			<div className="flex items-center justify-between gap-2 text-muted-foreground text-sm">
				<span>{label}</span>
				{Icon ? <Icon className="size-4" aria-hidden /> : null}
			</div>
			{loading ? (
				<Skeleton className="mt-3 h-8 w-28" />
			) : (
				<p className="numeric mt-2 font-semibold text-2xl tracking-tight">{value}</p>
			)}
			{hint && !loading ? <p className="mt-1 text-muted-foreground text-xs">{hint}</p> : null}
		</Surface>
	);
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
	return (
		<div className="px-5 py-12 text-center">
			<p className="font-medium">{title}</p>
			{description ? <p className="mt-1 text-muted-foreground text-sm">{description}</p> : null}
		</div>
	);
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
	return (
		<div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
			<TriangleAlert className="size-6 text-destructive" aria-hidden />
			<div>
				<p className="font-medium">โหลดข้อมูลไม่สำเร็จ</p>
				<p className="mt-1 text-muted-foreground text-sm">
					{error instanceof Error ? error.message : "เกิดข้อผิดพลาด"}
				</p>
			</div>
			{retry ? (
				<Button variant="outline" size="sm" onClick={retry}>
					<RotateCcw />
					ลองใหม่
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

type Tone = "good" | "warning" | "critical" | "neutral" | "info";

const toneClass: Record<Tone, string> = {
	good: "bg-success/12 text-success",
	warning: "bg-warning/15 text-warning-foreground dark:text-warning",
	critical: "bg-destructive/10 text-destructive",
	neutral: "bg-muted text-muted-foreground",
	info: "bg-primary/10 text-primary",
};

/** Status always carries its label; colour only reinforces it. */
export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
	return (
		<Badge variant="secondary" className={cn("rounded-md", toneClass[tone])}>
			{children}
		</Badge>
	);
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
