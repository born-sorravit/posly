import { FilterBarSkeleton, PagerSkeleton } from "@/components/catalog/inventory-skeletons";
import { PageHeaderSkeleton, TextSkeleton, range } from "@/components/common/skeleton-text";
import { PageContainer } from "@/components/common/primitives";
import { MetricCardSkeleton, SalesChartSkeleton } from "@/components/dashboard/dashboard-skeletons";
import { Skeleton } from "@posly/ui/components/skeleton";

/*
 * Loading shapes for the expenses page. Server-safe, so `expenses/loading.tsx` and the view's
 * own pending branches draw the same thing.
 */


/**
 * "แยกตามหมวด": the title, the 160px donut centred above, then category rows — a 24px icon
 * tile, name, share and amount on one line, the share bar under it. Stacked, not side by
 * side: the card is a third of the row, too narrow for the dashboard's donut-beside-legend.
 */
function ExpenseSplitSkeleton() {
	return (
		<div className="surface rounded-2xl p-5" aria-hidden>
			<div className="mb-4">
				<TextSkeleton box="h-6" bar="h-4" className="w-28" />
			</div>
			<div className="flex flex-col items-center gap-5">
				<div className="relative size-40 shrink-0">
					<Skeleton className="size-full rounded-full" />
					{/* The hole: the chart's inner radius is 68% of the outer. */}
					<div className="absolute inset-[16%] rounded-full bg-card" />
				</div>
				<div className="grid w-full gap-3">
					{range(3).map((i) => (
						<div key={i} className="grid gap-1.5">
							<div className="flex h-6 items-center gap-2.5">
								<Skeleton className="size-6 shrink-0 rounded-md" />
								<span className="min-w-0 flex-1">
									<Skeleton className="h-3.5" style={{ width: [64, 56, 72][i] }} />
								</span>
								<Skeleton className="h-3.5 w-10 shrink-0" />
								<Skeleton className="h-3.5 w-16 shrink-0" />
							</div>
							<Skeleton className="ml-8.5 h-1.5 rounded-full" />
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

/** The four figure cards, then the spend chart beside the category donut. */
export function ExpenseInsightsSkeleton() {
	return (
		<>
			<div className="grid grid-cols-2 gap-3 desktop:grid-cols-4 desktop:gap-4" aria-hidden>
				<MetricCardSkeleton tone="danger" />
				<MetricCardSkeleton tone="primary" />
				<MetricCardSkeleton tone="info" />
				<MetricCardSkeleton tone="warning" />
			</div>
			<div className="grid gap-4 desktop:grid-cols-3">
				<SalesChartSkeleton className="desktop:col-span-2" presets={false} />
				<ExpenseSplitSkeleton />
			</div>
		</>
	);
}

/**
 * The expenses table's rows: date, category (32px icon tile and name), note, who recorded it,
 * amount, then the row menu. A phone keeps date, category, amount and the menu.
 */
export function ExpenseRowsSkeleton({ rows = 8 }: { rows?: number }) {
	const th = "h-10 border-border border-b px-3 first:pl-5 last:pr-5";
	const td = "h-14 px-3 first:pl-5 last:pr-5";
	const tablet = "hidden tablet:table-cell";
	const desktop = "hidden desktop:table-cell";
	return (
		<div className="overflow-x-auto" aria-hidden>
			<table className="w-full border-separate border-spacing-0 text-sm">
				<thead>
					<tr>
						<th className={th}>
							<Skeleton className="h-3 w-10" />
						</th>
						<th className={th}>
							<Skeleton className="h-3 w-8" />
						</th>
						<th className={`${th} ${tablet}`}>
							<Skeleton className="h-3 w-16" />
						</th>
						<th className={`${th} ${desktop}`}>
							<Skeleton className="h-3 w-14" />
						</th>
						<th className={th}>
							<Skeleton className="ml-auto h-3 w-14" />
						</th>
						<th className={`${th} w-12`} />
					</tr>
				</thead>
				<tbody>
					{range(rows).map((i) => (
						<tr key={i} className="[&:not(:last-child)>td]:border-border/50 [&:not(:last-child)>td]:border-b">
							<td className={td}>
								<Skeleton className="h-4 w-20" />
							</td>
							<td className={td}>
								<span className="flex items-center gap-2.5">
									<Skeleton className="size-8 shrink-0 rounded-lg" />
									<Skeleton className="h-4" style={{ width: [56, 72, 48, 64, 40, 60][i % 6] }} />
								</span>
							</td>
							<td className={`${td} ${tablet}`}>
								<Skeleton className="h-4" style={{ width: [176, 120, 16, 208, 144, 96, 16, 160][i % 8] }} />
							</td>
							<td className={`${td} ${desktop}`}>
								<Skeleton className="h-4" style={{ width: [64, 80, 56][i % 3] }} />
							</td>
							<td className={td}>
								<Skeleton className="ml-auto h-4" style={{ width: [64, 72, 56, 80][i % 4] }} />
							</td>
							<td className={`${td} w-12`}>
								<Skeleton className="ml-auto size-7 rounded-md" />
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

/**
 * The expenses page: header with "บันทึกค่าใช้จ่าย", the period's total and its split, then the
 * table card with the period and category filters.
 */
export function ExpensesSkeleton() {
	return (
		<PageContainer>
			<PageHeaderSkeleton title="w-32" actions={["w-40"]} />
			<ExpenseInsightsSkeleton />
			<div className="surface overflow-hidden rounded-2xl">
				<FilterBarSkeleton chips={["w-28", "w-20"]} />
				<ExpenseRowsSkeleton />
				<PagerSkeleton />
			</div>
		</PageContainer>
	);
}
