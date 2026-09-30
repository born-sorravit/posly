import { TextSkeleton, range } from "@/components/common/skeleton-text";
import { PaymentBreakdownSkeleton, SalesChartSkeleton } from "@/components/dashboard/dashboard-skeletons";
import { cn } from "@/lib/utils";
import { Skeleton } from "@posly/ui/components/skeleton";

/*
 * The reports page's loading shapes: the route's loading.tsx draws the header, period line,
 * tab chips and the Sales tab; the view draws whichever tab is open while its query is
 * pending. Server-safe.
 */

/** `SectionTitle`: a `text-base` heading, optionally with a small control on the right. */
function TitleSkeleton({ className, action, flush = false }: { className?: string; action?: string; flush?: boolean }) {
	return (
		<div className={cn("flex items-center justify-between gap-3", !flush && "mb-4")}>
			<TextSkeleton box="h-6" bar="h-4" className={className} />
			{action ? <Skeleton className={cn("h-8 rounded-lg", action)} /> : null}
		</div>
	);
}

/** `PageHeader` with the range switcher (four options) and the export button. */
export function ReportsHeaderSkeleton() {
	return (
		<div className="flex flex-col gap-3 tablet:flex-row tablet:items-end tablet:justify-between" aria-hidden>
			<div className="min-w-0 space-y-1">
				<TextSkeleton box="h-8" bar="h-6" className="w-24" />
				<TextSkeleton className="w-64 max-w-full" />
			</div>
			<div className="flex shrink-0 flex-wrap items-center gap-2">
				<Skeleton className="h-9 w-72 rounded-lg" />
				<Skeleton className="h-9 w-28 rounded-lg" />
			</div>
		</div>
	);
}

/** The "1 ก.ย. – 7 ก.ย. vs …" line under the header, before the window is known. */
export function PeriodLineSkeleton() {
	return (
		<div className="flex h-5 min-w-0 items-center gap-2" aria-hidden>
			<Skeleton className="size-4 shrink-0 rounded" />
			<Skeleton className="h-3.5 w-40" />
			<Skeleton className="hidden h-3.5 w-44 tablet:block" />
		</div>
	);
}

/**
 * The period row at route level: the window line, and the compare switcher (`sm`) beside it
 * from tablet up — drawn, as the shops that open reports most are on a plan with Advanced.
 */
export function PeriodSummarySkeleton() {
	return (
		<div className="flex flex-col gap-2 tablet:flex-row tablet:items-center tablet:justify-between" aria-hidden>
			<PeriodLineSkeleton />
			<Skeleton className="h-8 w-40 rounded-lg" />
		</div>
	);
}

/** The seven report tabs as `Segmented` chips (`lg`, 44px tall). */
export function ReportTabsSkeleton() {
	return (
		<div className="no-scrollbar -mx-1 flex max-w-full items-center gap-1.5 overflow-x-auto px-1 py-1" aria-hidden>
			{[84, 76, 96, 72, 84, 100, 88].map((w, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder chips; widths repeat
				<Skeleton key={i} className="h-11 shrink-0 rounded-xl" style={{ width: w }} />
			))}
		</div>
	);
}

/**
 * A plain `MetricCard`: icon chip and label, the figure, and (with `trend`) the one-line change
 * against the previous period.
 */
function MetricCardSkeleton({ trend }: { trend: boolean }) {
	return (
		<div className="surface flex min-w-0 flex-col gap-2.5 rounded-2xl p-4 tablet:gap-3 tablet:p-5">
			<div className="flex items-center gap-2.5 tablet:gap-3">
				<Skeleton className="size-8 shrink-0 rounded-lg tablet:size-9" />
				<Skeleton className="h-3 w-20 tablet:h-3.5 tablet:w-24" />
			</div>
			<TextSkeleton box="h-[25px] tablet:h-7" bar="h-5 tablet:h-6" className="w-24 tablet:w-32" />
			{trend ? <TextSkeleton box="h-4" bar="h-3" className="w-24" /> : null}
		</div>
	);
}

/** Four metric cards, two to a row below desktop. */
export function ReportMetricsSkeleton({ trend = true }: { trend?: boolean }) {
	return (
		<div className="grid grid-cols-2 gap-3 desktop:grid-cols-4" aria-hidden>
			{range(4).map((i) => (
				<MetricCardSkeleton key={i} trend={trend} />
			))}
		</div>
	);
}

/**
 * `ProfitBreakdown`: the sales-to-profit steps (two totals ruled off), then the margin, the split
 * bar and its legend beside them from desktop up, and the hint.
 */
export function ProfitBreakdownSkeleton() {
	const steps = [
		["w-16", "w-20", false],
		["w-24", "w-16", false],
		["w-20", "w-20", true],
		["w-20", "w-16", false],
		["w-28", "w-20", true],
	] as const;
	return (
		<div className="surface rounded-2xl p-5" aria-hidden>
			<TitleSkeleton className="w-36" />
			<div className="grid gap-6 desktop:grid-cols-2 desktop:gap-10">
				<div>
					{steps.map(([label, value, total], i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
							key={i}
							className={cn("flex items-center justify-between gap-4 py-2.5", total && "border-border border-t")}
						>
							<TextSkeleton className={label} />
							<TextSkeleton className={value} />
						</div>
					))}
				</div>
				<div className="flex flex-col gap-4 desktop:border-border desktop:border-l desktop:pl-10">
					<div>
						<TextSkeleton className="w-28" />
						<TextSkeleton box="mt-1 h-9" bar="h-7" className="w-24" />
						<TextSkeleton box="mt-1 h-4" bar="h-3" className="w-48" />
					</div>
					<Skeleton className="h-3 rounded-full" />
					<div className="grid gap-2">
						{range(3).map((i) => (
							<div key={i} className="flex h-5 items-center gap-2.5">
								<Skeleton className="size-2.5 shrink-0 rounded-full" />
								<span className="flex-1">
									<Skeleton className="h-3.5" style={{ width: [72, 64, 88][i] }} />
								</span>
								<Skeleton className="h-3.5 w-10" />
							</div>
						))}
					</div>
				</div>
			</div>
			<TextSkeleton box="mt-4 h-5" bar="h-3" className="w-3/4" />
		</div>
	);
}

/**
 * `PeriodTable`: its own table (48px rows, a total row), period · orders · revenue, plus the
 * average from tablet and the share bar from desktop. Seven rows for the default 7-day range.
 */
export function PeriodTableSkeleton({ rows = 7 }: { rows?: number }) {
	const td = "h-12 border-border/50 border-b";
	return (
		<div className="surface rounded-2xl p-0" aria-hidden>
			<div className="flex items-center justify-between gap-3 px-5 pt-5">
				<TitleSkeleton className="w-28" flush />
			</div>
			<div className="mt-3 overflow-x-auto">
				<table className="w-full border-separate border-spacing-0 text-sm">
					<thead>
						<tr className="[&>th]:h-10 [&>th]:border-border [&>th]:border-b">
							<th className="pl-5">
								<Skeleton className="h-3 w-12" />
							</th>
							<th className="px-3">
								<Skeleton className="ml-auto h-3 w-12" />
							</th>
							<th className="px-3">
								<Skeleton className="ml-auto h-3 w-12" />
							</th>
							<th className="hidden px-3 tablet:table-cell">
								<Skeleton className="ml-auto h-3 w-14" />
							</th>
							<th className="hidden w-[28%] pr-5 pl-3 desktop:table-cell">
								<Skeleton className="h-3 w-12" />
							</th>
						</tr>
					</thead>
					<tbody>
						{range(rows).map((i) => (
							<tr key={i}>
								<td className={`${td} pl-5`}>
									<Skeleton className="h-4" style={{ width: [96, 88, 104, 92, 100, 84, 96][i % 7] }} />
								</td>
								<td className={`${td} px-3`}>
									<Skeleton className="ml-auto h-4 w-6" />
								</td>
								<td className={`${td} px-3`}>
									<Skeleton className="ml-auto h-4 w-16" />
								</td>
								<td className={`${td} hidden px-3 tablet:table-cell`}>
									<Skeleton className="ml-auto h-4 w-14" />
								</td>
								<td className={`${td} hidden pr-5 pl-3 desktop:table-cell`}>
									<Skeleton className="h-2 rounded-full" style={{ width: `${[64, 48, 88, 56, 100, 40, 72][i % 7]}%` }} />
								</td>
							</tr>
						))}
					</tbody>
					<tfoot>
						<tr>
							<td className="h-12 pl-5">
								<Skeleton className="h-4 w-10" />
							</td>
							<td className="h-12 px-3">
								<Skeleton className="ml-auto h-4 w-8" />
							</td>
							<td className="h-12 px-3">
								<Skeleton className="ml-auto h-4 w-20" />
							</td>
							<td className="hidden h-12 px-3 tablet:table-cell">
								<Skeleton className="ml-auto h-4 w-14" />
							</td>
							<td className="hidden desktop:table-cell" />
						</tr>
					</tfoot>
				</table>
			</div>
		</div>
	);
}

/** A `Surface p-0` holding a `DataTable`: heading, header row, then 56px rows. */
function TableSurfaceSkeleton({
	rows = 5,
	title = true,
	action,
	hint = false,
}: {
	rows?: number;
	/** The employees table has no heading of its own. */
	title?: boolean;
	/** Width class of a small switcher beside the heading. */
	action?: string;
	/** A caption line under the heading. */
	hint?: boolean;
}) {
	const th = "h-10 border-border border-b px-3 first:pl-5 last:pr-5";
	const td = "h-14 px-3 first:pl-5 last:pr-5";
	return (
		<div className="surface rounded-2xl p-0" aria-hidden>
			{title ? (
				<div className="px-5 pt-5">
					<TitleSkeleton className="w-32" action={action} flush={Boolean(action) || hint} />
					{hint ? <TextSkeleton box="mt-1 mb-3 h-4" bar="h-3" className="w-56" /> : null}
				</div>
			) : null}
			<div className={cn("overflow-x-auto", action && "mt-3")}>
				<table className="w-full border-separate border-spacing-0 text-sm">
					<thead>
						<tr>
							<th className={th}>
								<Skeleton className="h-3 w-16" />
							</th>
							<th className={th}>
								<Skeleton className="ml-auto h-3 w-12" />
							</th>
							<th className={th}>
								<Skeleton className="ml-auto h-3 w-12" />
							</th>
							<th className={`${th} hidden tablet:table-cell`}>
								<Skeleton className="ml-auto h-3 w-14" />
							</th>
						</tr>
					</thead>
					<tbody>
						{range(rows).map((i) => (
							<tr key={i} className="[&:not(:last-child)>td]:border-border/50 [&:not(:last-child)>td]:border-b">
								<td className={td}>
									<Skeleton className="h-4" style={{ width: [120, 96, 136, 104, 112][i % 5] }} />
								</td>
								<td className={td}>
									<Skeleton className="ml-auto h-4 w-8" />
								</td>
								<td className={td}>
									<Skeleton className="ml-auto h-4 w-16" />
								</td>
								<td className={`${td} hidden tablet:table-cell`}>
									<Skeleton className="ml-auto h-4 w-14" />
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

/** The Sales tab: metrics, profit breakdown, the 300px sales chart, then the period table. */
export function SalesTabSkeleton() {
	return (
		<>
			<ReportMetricsSkeleton />
			<ProfitBreakdownSkeleton />
			<SalesChartSkeleton height={300} />
			<PeriodTableSkeleton />
		</>
	);
}

/** One `ProductList`: heading, then ruled rows of thumbnail, name, units and revenue. */
function ProductListSkeleton({ rows }: { rows: number }) {
	return (
		<div className="surface rounded-2xl p-5">
			<TitleSkeleton className="w-24" />
			<div className="divide-y">
				{range(rows).map((i) => (
					<div key={i} className="flex items-center gap-3 py-2.5">
						<Skeleton className="size-9 shrink-0 rounded-lg" />
						<span className="flex-1">
							<Skeleton className="h-3.5" style={{ width: `${[44, 58, 36][i % 3]}%` }} />
						</span>
						<Skeleton className="h-3.5 w-12" />
						<span className="flex w-20 justify-end">
							<Skeleton className="h-3.5 w-14" />
						</span>
					</div>
				))}
			</div>
		</div>
	);
}

/** The Products tab: revenue bars beside the best and slowest sellers. */
export function ProductsTabSkeleton() {
	return (
		<div className="grid gap-4 desktop:grid-cols-2" aria-hidden>
			<div className="surface rounded-2xl p-5">
				<TitleSkeleton className="w-32" />
				<div className="grid gap-3">
					{range(5).map((i) => (
						<div key={i} className="grid grid-cols-[8rem_1fr_5rem] items-center gap-3">
							<span className="flex items-center gap-2">
								<Skeleton className="size-7 shrink-0 rounded-md" />
								<Skeleton className="h-3.5" style={{ width: [64, 56, 72, 48, 60][i] }} />
							</span>
							<Skeleton className="h-2.5 rounded-full" />
							<Skeleton className="ml-auto h-3.5 w-14" />
						</div>
					))}
				</div>
			</div>
			<div className="grid gap-4">
				<ProductListSkeleton rows={3} />
				<ProductListSkeleton rows={3} />
			</div>
		</div>
	);
}

/** Peak hours: the chart card with its view, measure and day switchers, then two lists. */
export function PeakHoursSkeleton() {
	return (
		<div className="grid gap-4" aria-hidden>
			<div className="surface min-w-0 rounded-2xl p-5">
				<TitleSkeleton className="w-40" action="w-40" />
				<div className="-mt-1 mb-5 flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between">
					<TextSkeleton bar="h-3" className="w-64 max-w-full" />
					<Skeleton className="h-8 w-36 shrink-0 self-start rounded-lg" />
				</div>
				<div className="no-scrollbar -mx-1 flex gap-1.5 overflow-hidden px-1 py-1">
					{range(8).map((i) => (
						<Skeleton key={i} className={cn("h-7 shrink-0 rounded-lg", i === 0 ? "w-20" : "w-10")} />
					))}
				</div>
				<TextSkeleton box="mt-4 mb-2 h-5" className="w-56" />
				<div className="-ml-2 flex h-[260px] items-end gap-1.5 border-border border-b pb-0 pl-12">
					{[20, 28, 44, 62, 80, 70, 52, 58, 74, 90, 66, 40, 26].map((h, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder bars; heights may repeat
						<Skeleton key={i} className="flex-1 rounded-t-md rounded-b-none" style={{ height: `${h}%` }} />
					))}
				</div>
			</div>
			<div className="grid items-start gap-4 desktop:grid-cols-2">
				<div className="surface rounded-2xl p-5">
					<TitleSkeleton className="w-32" />
					<div className="grid gap-1">
						{range(5).map((i) => (
							<div key={i} className="flex items-center gap-4 px-1 py-2.5">
								<Skeleton className="size-8 shrink-0 rounded-lg" />
								<div className="min-w-0 flex-1">
									<TextSkeleton className="w-20" />
									<TextSkeleton box="h-4" bar="h-3" className="w-24" />
								</div>
								<Skeleton className="h-4 w-16" />
							</div>
						))}
					</div>
				</div>
				<div className="surface rounded-2xl p-5">
					<TitleSkeleton className="w-28" />
					<div className="grid gap-3.5">
						{range(7).map((i) => (
							<div
								key={i}
								className="grid grid-cols-[4.75rem_1fr_5.25rem] items-center gap-3 tablet:grid-cols-[5.5rem_1fr_6.5rem] tablet:gap-4"
							>
								<TextSkeleton className="w-14" />
								<Skeleton className="h-2 rounded-full" />
								<Skeleton className="ml-auto h-4 w-14" />
							</div>
						))}
					</div>
					<TextSkeleton box="mt-5 h-5" bar="h-3" className="w-3/4" />
				</div>
			</div>
		</div>
	);
}

/** Profit by line: four totals, the hint, then the category table and the sortable product table. */
export function ProfitInsightsSkeleton() {
	return (
		<>
			<ReportMetricsSkeleton trend={false} />
			<TextSkeleton bar="h-3" className="w-96 max-w-full" />
			<TableSurfaceSkeleton rows={4} />
			<TableSurfaceSkeleton rows={6} action="w-44" />
		</>
	);
}

/** Customers: four totals, then top customers beside the lapsed regulars. */
export function CustomerInsightsSkeleton() {
	return (
		<>
			<ReportMetricsSkeleton trend={false} />
			<div className="grid gap-4 desktop:grid-cols-2">
				<TableSurfaceSkeleton rows={5} />
				<TableSurfaceSkeleton rows={4} hint />
			</div>
		</>
	);
}

/** Whichever tab is open, in its own shape. */
export function ReportTabSkeleton({ tab }: { tab: string }) {
	switch (tab) {
		case "products":
			return <ProductsTabSkeleton />;
		case "payments":
			return <PaymentBreakdownSkeleton />;
		case "employees":
			return <TableSurfaceSkeleton rows={4} title={false} />;
		case "peak":
			return <PeakHoursSkeleton />;
		case "profit":
			return <ProfitInsightsSkeleton />;
		case "customers":
			return <CustomerInsightsSkeleton />;
		default:
			return <SalesTabSkeleton />;
	}
}
