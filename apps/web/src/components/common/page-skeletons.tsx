import { range } from "@/components/common/skeleton-text";
import { PageContainer } from "@/components/common/primitives";
import { DashboardBodySkeleton, HeroSkeleton } from "@/components/dashboard/dashboard-skeletons";
import {
	PeriodSummarySkeleton,
	ReportTabsSkeleton,
	ReportsHeaderSkeleton,
	SalesTabSkeleton,
} from "@/components/reports/reports-skeletons";
import { SettingsIndexSkeleton } from "@/components/settings/settings-skeletons";
import { Skeleton } from "@posly/ui/components/skeleton";

/*
 * Route-level loading states. Each one is the shape of the page it stands in for, so the
 * layout does not jump when the real page lands (plan §31: grey shapes, never a spinner).
 */


/** Title, one-line description and the header action. */
export function HeaderSkeleton({ action = true }: { action?: boolean }) {
	return (
		<div className="flex items-end justify-between gap-4">
			<div className="space-y-2">
				<Skeleton className="h-7 w-44" />
				<Skeleton className="h-4 w-64" />
			</div>
			{action ? <Skeleton className="h-10 w-32 rounded-lg" /> : null}
		</div>
	);
}

/** The table card: filter toolbar, header row, then rows — the same rhythm as `DataTable`. */
export function TableCardSkeleton({ rows = 8, thumb = true }: { rows?: number; thumb?: boolean }) {
	return (
		<div className="surface overflow-hidden rounded-2xl">
			<div className="flex items-center gap-2 border-border/60 border-b px-4 py-3">
				<Skeleton className="h-8 w-full rounded-md tablet:w-72" />
				<Skeleton className="hidden h-8 w-24 rounded-md tablet:block" />
				<Skeleton className="hidden h-8 w-24 rounded-md tablet:block" />
			</div>
			<div className="flex h-10 items-center gap-6 border-border border-b px-5">
				<Skeleton className="h-3 w-20" />
				<Skeleton className="ml-auto h-3 w-16" />
				<Skeleton className="h-3 w-16" />
				<Skeleton className="hidden h-3 w-16 tablet:block" />
			</div>
			{range(rows).map((i) => (
				<div key={i} className="flex h-14 items-center gap-4 border-border/50 border-b px-5 last:border-b-0">
					{thumb ? <Skeleton className="size-9 shrink-0 rounded-lg" /> : null}
					{/* Varying widths read as real names rather than a barcode. */}
					<Skeleton className="h-4" style={{ width: `${[38, 26, 32, 22, 30, 24, 34, 28][i % 8]}%` }} />
					<Skeleton className="ml-auto h-4 w-16" />
					<Skeleton className="h-4 w-14" />
					<Skeleton className="hidden h-6 w-16 rounded-lg tablet:block" />
				</div>
			))}
		</div>
	);
}

/** Orders, products, stock, customers, employees, categories. */
export function ListPageSkeleton() {
	return (
		<PageContainer>
			<HeaderSkeleton />
			<TableCardSkeleton />
		</PageContainer>
	);
}

/** The dashboard: the dark hero with the period select, then everything under it (see dashboard-skeletons). */
export function DashboardSkeleton() {
	return (
		<PageContainer>
			<HeroSkeleton />
			<DashboardBodySkeleton />
		</PageContainer>
	);
}

/** Reports: header with range switcher and export, the period row, the tab chips, then the Sales tab. */
export function ReportsSkeleton() {
	return (
		<PageContainer>
			<ReportsHeaderSkeleton />
			<PeriodSummarySkeleton />
			<ReportTabsSkeleton />
			<SalesTabSkeleton />
		</PageContainer>
	);
}

/**
 * `/settings` itself, inside the settings layout (title and rail stay rendered): the section
 * list on a phone, the General panel from tablet up. Each section has its own loading.tsx.
 */
export function SettingsSkeleton() {
	return <SettingsIndexSkeleton />;
}

/**
 * The sales table's rows while a page loads: a real table with the same cells as the orders
 * `DataTable`, so the columns line up — number and tag, time, items, employee, method, total,
 * status — and the phone keeps only the columns the phone shows.
 */
export function OrderRowsSkeleton({ rows = 8 }: { rows?: number }) {
	const cell = "h-14 px-3 first:pl-5 last:pr-5";
	const wide = "hidden tablet:table-cell";
	return (
		<div className="overflow-x-auto" aria-hidden>
			<table className="w-full border-separate border-spacing-0 text-sm">
				<thead>
					<tr>
						{[
							["w-14", ""],
							["w-10", ""],
							["w-16", wide],
							["w-16", wide],
							["w-14", wide],
						].map(([w, hide], i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: static header cells
							<th key={i} className={`h-10 border-border border-b px-3 first:pl-5 ${hide}`}>
								<Skeleton className={`h-3 ${w}`} />
							</th>
						))}
						<th className="h-10 border-border border-b px-3">
							<Skeleton className="ml-auto h-3 w-12" />
						</th>
						<th className="h-10 w-36 border-border border-b pr-5 pl-8">
							<Skeleton className="h-3 w-12" />
						</th>
					</tr>
				</thead>
				<tbody>
					{range(rows).map((i) => (
						<tr key={i} className="[&:not(:last-child)>td]:border-border/50 [&:not(:last-child)>td]:border-b">
							<td className={cell}>
								<Skeleton className="h-4 w-12" />
								{/* Some orders carry a table or a name under the number. */}
								{i % 3 === 1 ? <Skeleton className="mt-1.5 h-3 w-16" /> : null}
							</td>
							<td className={cell}>
								<Skeleton className="h-4 w-11" />
							</td>
							<td className={`${cell} ${wide}`}>
								<Skeleton className="h-4" style={{ width: [176, 128, 208, 96, 152, 184, 112, 160][i % 8] }} />
							</td>
							<td className={`${cell} ${wide}`}>
								<Skeleton className="h-4 w-20" />
							</td>
							<td className={`${cell} ${wide}`}>
								<span className="flex items-center gap-1.5">
									<Skeleton className="size-4 rounded" />
									<Skeleton className="h-4 w-14" />
								</span>
							</td>
							<td className={cell}>
								<Skeleton className="ml-auto h-4 w-16" />
							</td>
							<td className={`${cell} w-36 pl-8`}>
								<Skeleton className="h-6 w-20 rounded-full" />
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

/** The sales page: header with export, then the table card with search and three filters. */
export function OrdersSkeleton() {
	return (
		<PageContainer>
			<div className="flex flex-col gap-3 tablet:flex-row tablet:items-end tablet:justify-between">
				<div className="space-y-2">
					<Skeleton className="h-7 w-32" />
					<Skeleton className="h-4 w-48" />
				</div>
				<Skeleton className="h-9 w-32 rounded-lg" />
			</div>
			<div className="surface overflow-hidden rounded-2xl">
				<div className="flex flex-col gap-2 border-border/60 border-b px-4 py-3 tablet:flex-row tablet:items-center">
					<Skeleton className="h-8 w-full rounded-md tablet:w-72" />
					<div className="flex gap-2">
						<Skeleton className="h-8 w-24 rounded-md" />
						<Skeleton className="h-8 w-24 rounded-md" />
						<Skeleton className="h-8 w-28 rounded-md" />
					</div>
				</div>
				<OrderRowsSkeleton />
			</div>
		</PageContainer>
	);
}

/** One kitchen ticket: number, clock and wait, the lines with their tick boxes, then progress and the move button. */
export function TicketSkeleton({ lines = 3 }: { lines?: number }) {
	return (
		<div className="surface overflow-hidden rounded-2xl" aria-hidden>
			<div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
				<Skeleton className="h-5 w-10" />
				<Skeleton className="h-3 w-10" />
				<Skeleton className="ml-auto h-5 w-14 rounded-md" />
			</div>
			<div className="px-2 pb-2">
				{range(lines).map((i) => (
					<div key={i} className="flex items-center gap-2.5 px-2 py-2">
						<Skeleton className="size-5 shrink-0 rounded-md" />
						<Skeleton className="h-5 w-7 shrink-0 rounded-md" />
						<Skeleton className="h-4" style={{ width: `${[55, 40, 62, 48][i % 4]}%` }} />
					</div>
				))}
			</div>
			<div className="space-y-2.5 border-t px-4 py-3">
				<div className="flex items-center gap-2">
					<Skeleton className="h-1 flex-1 rounded-full" />
					<Skeleton className="h-3 w-6" />
				</div>
				<div className="flex items-center gap-2">
					<Skeleton className="h-3 w-24" />
					<Skeleton className="ml-auto h-8 w-24 rounded-lg" />
				</div>
			</div>
		</div>
	);
}

/**
 * The kitchen board: title, live status and the two buttons, then new / cooking / ready. From
 * tablet up the three columns fill the screen; a phone stacks them folded, headings only.
 */
export function KitchenSkeleton() {
	const tones = ["bg-chart-4", "bg-warning", "bg-success"];
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4 tablet:h-[calc(100svh-4rem-var(--demo-banner-h,0px))] tablet:flex-none desktop:px-6">
			<div className="flex flex-wrap items-center gap-3">
				<Skeleton className="h-8 w-20" />
				<Skeleton className="h-4 w-16" />
				<Skeleton className="h-4 w-36" />
				<div className="ml-auto flex gap-2">
					<Skeleton className="h-9 w-28 rounded-lg" />
					<Skeleton className="h-9 w-28 rounded-lg" />
				</div>
			</div>
			<div className="grid min-h-0 flex-1 content-start gap-4 tablet:grid-cols-3 tablet:grid-rows-[minmax(0,1fr)] tablet:content-stretch">
				{tones.map((tone, column) => (
					<div key={tone} className="flex min-h-0 flex-col overflow-hidden rounded-3xl bg-muted/40 p-3">
						<div className="flex items-center gap-2 px-1 py-0.5 tablet:mb-3 tablet:py-0">
							<span className={`size-2.5 rounded-full opacity-60 ${tone}`} />
							<Skeleton className="h-5 w-20" />
							<Skeleton className="ml-auto h-6 w-8 rounded-full" />
						</div>
						<div className="hidden space-y-3 tablet:block">
							{range(column === 2 ? 1 : 2).map((i) => (
								<TicketSkeleton key={i} lines={[3, 2][i]} />
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
