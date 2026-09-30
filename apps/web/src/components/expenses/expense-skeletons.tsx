import { FilterBarSkeleton, PagerSkeleton } from "@/components/catalog/inventory-skeletons";
import { PageHeaderSkeleton, range } from "@/components/common/skeleton-text";
import { PageContainer } from "@/components/common/primitives";
import { Skeleton } from "@posly/ui/components/skeleton";

/*
 * Loading shapes for the expenses page. Server-safe, so `expenses/loading.tsx` and the view's
 * own pending branches draw the same thing.
 */


/** The summary card's figure while it loads: the 36px `text-3xl` total, never a fake ฿0. */
export function ExpenseTotalSkeleton() {
	return (
		<div className="flex h-9 items-center" aria-hidden>
			<Skeleton className="h-8 w-40" />
		</div>
	);
}

/** The split under the total: the category bar, then three legend rows (dot, name, amount). */
export function ExpenseSplitSkeleton() {
	return (
		<div className="space-y-4" aria-hidden>
			<Skeleton className="h-2.5 w-full rounded-full" />
			<div className="grid gap-x-6 gap-y-2 tablet:grid-cols-3">
				{range(3).map((i) => (
					<div key={i} className="flex h-5 items-center gap-2">
						<Skeleton className="size-2 rounded-full" />
						<Skeleton className="h-4" style={{ width: [56, 72, 48][i] }} />
						<Skeleton className="ml-auto h-4 w-16" />
					</div>
				))}
			</div>
		</div>
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
			<div className="surface space-y-4 rounded-2xl p-5" aria-hidden>
				<div className="flex items-end justify-between gap-4">
					<div>
						<div className="flex h-5 items-center">
							<Skeleton className="h-4 w-24" />
						</div>
						<ExpenseTotalSkeleton />
					</div>
					<Skeleton className="size-8 rounded-lg" />
				</div>
				<ExpenseSplitSkeleton />
			</div>
			<div className="surface overflow-hidden rounded-2xl">
				<FilterBarSkeleton chips={["w-28", "w-20"]} />
				<ExpenseRowsSkeleton />
				<PagerSkeleton />
			</div>
		</PageContainer>
	);
}
