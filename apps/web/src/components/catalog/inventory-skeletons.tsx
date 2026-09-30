import { PageHeaderSkeleton, range } from "@/components/common/skeleton-text";
import { PageContainer } from "@/components/common/primitives";
import { Skeleton } from "@posly/ui/components/skeleton";

/*
 * Loading shapes for the stock pages (สต็อกสินค้า, วัตถุดิบ, ประวัติการปรับ). Server-safe, so the
 * route `loading.tsx` files and the views' own pending branches draw the same thing.
 */


/** `DataTable`'s cell and row rhythm, so skeleton columns sit where the real ones will. */
const th = "h-10 border-border border-b px-3 first:pl-5 last:pr-5";
const td = "h-14 px-3 first:pl-5 last:pr-5";
const tr = "[&:not(:last-child)>td]:border-border/50 [&:not(:last-child)>td]:border-b";
const tablet = "hidden tablet:table-cell";

/** `InventoryTabs`: สินค้า / วัตถุดิบ, an icon and a word each, over the hairline. */
export function InventoryTabsSkeleton() {
	return (
		<div className="flex gap-6 border-border border-b" aria-hidden>
			{["w-10", "w-14"].map((w) => (
				<div key={w} className="-mb-px flex h-11 items-center gap-2 px-0.5">
					<Skeleton className="size-4 rounded" />
					<Skeleton className={`h-4 ${w}`} />
				</div>
			))}
		</div>
	);
}

/** `FilterBar`: optionally the 32px toolbar search, then one 32px chip per filter. */
export function FilterBarSkeleton({ search = false, chips }: { search?: boolean; chips: string[] }) {
	return (
		<div className="flex flex-col gap-2 border-border/60 border-b px-4 py-3 tablet:flex-row tablet:items-center" aria-hidden>
			{search ? <Skeleton className="h-8 w-full rounded-md tablet:w-72" /> : null}
			<div className="flex flex-wrap items-center gap-2">
				{chips.map((w) => (
					<Skeleton key={w} className={`h-8 rounded-md ${w}`} />
				))}
			</div>
		</div>
	);
}

/** `Pager`'s "แสดง 1–20 จาก 57 รายการ" line, so the card's foot does not jump when rows land. */
export function PagerSkeleton() {
	return (
		<div className="flex flex-col items-center justify-between gap-3 px-5 py-4 tablet:flex-row" aria-hidden>
			<div className="flex h-5 items-center">
				<Skeleton className="h-4 w-40" />
			</div>
		</div>
	);
}

/** One `MetricCard` (plain, no trend): icon chip and label, then the number. */
function MetricCardSkeleton() {
	return (
		<div className="surface flex min-w-0 flex-col gap-2.5 rounded-2xl p-4 tablet:gap-3 tablet:p-5">
			<div className="flex items-center gap-2.5 tablet:gap-3">
				<Skeleton className="size-8 shrink-0 rounded-lg tablet:size-9" />
				<Skeleton className="h-3 w-12 tablet:h-4 tablet:w-16" />
			</div>
			<Skeleton className="h-6 w-10 tablet:h-7" />
		</div>
	);
}

/**
 * The stock table's rows: product (40px thumb and name), on hand, minimum, status badge, then
 * history and "ปรับสต็อก". No phone list — a phone keeps product, on hand and status.
 */
export function StockRowsSkeleton({ rows = 8 }: { rows?: number }) {
	return (
		<div className="overflow-x-auto" aria-hidden>
			<table className="w-full border-separate border-spacing-0 text-sm">
				<thead>
					<tr>
						<th className={th}>
							<Skeleton className="h-3 w-12" />
						</th>
						<th className={th}>
							<Skeleton className="ml-auto h-3 w-12" />
						</th>
						<th className={`${th} ${tablet}`}>
							<Skeleton className="ml-auto h-3 w-10" />
						</th>
						<th className={th}>
							<Skeleton className="h-3 w-10" />
						</th>
						<th className={`${th} ${tablet}`} />
					</tr>
				</thead>
				<tbody>
					{range(rows).map((i) => (
						<tr key={i} className={tr}>
							<td className={td}>
								<span className="flex items-center gap-3">
									<Skeleton className="size-10 shrink-0 rounded-lg" />
									<Skeleton className="h-4" style={{ width: [136, 104, 168, 88, 124, 152, 96, 144][i % 8] }} />
								</span>
							</td>
							<td className={td}>
								<Skeleton className="ml-auto h-4" style={{ width: [52, 60, 44, 56][i % 4] }} />
							</td>
							<td className={`${td} ${tablet}`}>
								<Skeleton className="ml-auto h-4 w-6" />
							</td>
							<td className={td}>
								<Skeleton className="h-6 w-14 rounded-lg" />
							</td>
							<td className={`${td} ${tablet}`}>
								<span className="flex items-center justify-end gap-1">
									<Skeleton className="size-7 rounded-md" />
									<Skeleton className="h-7 w-20 rounded-md" />
								</span>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

/** The stock page: header with history and "รับสินค้าเข้า", the tabs, three counts, then the table card. */
export function InventorySkeleton() {
	return (
		<PageContainer>
			<PageHeaderSkeleton title="w-36" actions={["w-36", "w-32"]} />
			<InventoryTabsSkeleton />
			<div className="grid grid-cols-3 gap-3" aria-hidden>
				{range(3).map((i) => (
					<MetricCardSkeleton key={i} />
				))}
			</div>
			<div className="surface overflow-hidden rounded-2xl">
				<FilterBarSkeleton search chips={["w-20"]} />
				<StockRowsSkeleton />
				<PagerSkeleton />
			</div>
		</PageContainer>
	);
}

/**
 * The ingredients list: on a phone, `mobileRow`'s name and detail beside on-hand over its
 * badge and the menu; from tablet up, the table — name and recipes, as bought (owners only),
 * on hand, status, then "ปรับสต็อก" and the menu.
 */
export function IngredientRowsSkeleton({ rows = 8, cost = true }: { rows?: number; cost?: boolean }) {
	const name = [120, 88, 144, 104, 72, 132, 96, 112];
	// Some ingredients are not counted: no number to show, and no "ปรับสต็อก" button.
	const tracked = (i: number) => i % 3 !== 2;
	return (
		<div aria-hidden>
			<ul className="divide-y divide-border/50 tablet:hidden">
				{range(rows).map((i) => (
					<li key={i} className="px-4 py-3">
						<div className="flex items-center gap-3">
							<div className="min-w-0 flex-1 space-y-1.5">
								<Skeleton className="h-4" style={{ width: name[i % 8] }} />
								<Skeleton className="h-3" style={{ width: [168, 112, 184, 96][i % 4] }} />
							</div>
							<div className="flex items-center gap-2">
								<span className="grid justify-items-end gap-1">
									<Skeleton className="h-4" style={{ width: tracked(i) ? 64 : 56 }} />
									{tracked(i) ? <Skeleton className="h-6 w-14 rounded-lg" /> : null}
								</span>
								<Skeleton className="size-7 rounded-md" />
							</div>
						</div>
					</li>
				))}
			</ul>
			<div className="hidden overflow-x-auto tablet:block">
				<table className="w-full border-separate border-spacing-0 text-sm">
					<thead>
						<tr>
							<th className={th}>
								<Skeleton className="h-3 w-16" />
							</th>
							{cost ? (
								<th className={th}>
									<Skeleton className="ml-auto h-3 w-14" />
								</th>
							) : null}
							<th className={th}>
								<Skeleton className="ml-auto h-3 w-12" />
							</th>
							<th className={th}>
								<Skeleton className="h-3 w-10" />
							</th>
							<th className={th} />
						</tr>
					</thead>
					<tbody>
						{range(rows).map((i) => (
							<tr key={i} className={tr}>
								<td className={td}>
									<Skeleton className="h-4" style={{ width: name[i % 8] }} />
									<Skeleton className="mt-1.5 h-3" style={{ width: [72, 96, 64, 88][i % 4] }} />
								</td>
								{cost ? (
									<td className={td}>
										<Skeleton className="ml-auto h-4" style={{ width: [104, 88, 116, 96][i % 4] }} />
										{i % 4 !== 3 ? <Skeleton className="mt-1.5 ml-auto h-3 w-28" /> : null}
									</td>
								) : null}
								<td className={td}>
									<Skeleton className="ml-auto h-4" style={{ width: tracked(i) ? [68, 56, 76][i % 3] : 12 }} />
								</td>
								<td className={td}>
									<Skeleton className="h-6 rounded-lg" style={{ width: tracked(i) ? 56 : 80 }} />
								</td>
								<td className={td}>
									<span className="flex items-center justify-end gap-1">
										{tracked(i) ? <Skeleton className="h-7 w-20 rounded-md" /> : null}
										<Skeleton className="size-7 rounded-md" />
									</span>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

/** The ingredients page: header with "เพิ่มวัตถุดิบ", the tabs, the list card, then the footnote. */
export function IngredientsSkeleton() {
	return (
		<PageContainer>
			<PageHeaderSkeleton title="w-24" actions={["w-32"]} />
			<InventoryTabsSkeleton />
			<div className="surface overflow-hidden rounded-2xl">
				<IngredientRowsSkeleton />
			</div>
			<div className="space-y-1.5" aria-hidden>
				<Skeleton className="h-3 w-full max-w-2xl" />
				<Skeleton className="h-3 w-2/3 max-w-md" />
			</div>
		</PageContainer>
	);
}

/**
 * The adjustment history's rows: when, product (36px thumb, sometimes the price paid under
 * it), type badge, change (a count also says what was counted), before → after, who, note.
 */
export function StockHistoryRowsSkeleton({ rows = 8 }: { rows?: number }) {
	const desktop = "hidden desktop:table-cell";
	return (
		<div className="overflow-x-auto" aria-hidden>
			<table className="w-full border-separate border-spacing-0 text-sm">
				<thead>
					<tr>
						<th className={th}>
							<Skeleton className="h-3 w-8" />
						</th>
						<th className={th}>
							<Skeleton className="h-3 w-12" />
						</th>
						<th className={th}>
							<Skeleton className="h-3 w-10" />
						</th>
						<th className={th}>
							<Skeleton className="ml-auto h-3 w-16" />
						</th>
						<th className={`${th} ${tablet}`}>
							<Skeleton className="ml-auto h-3 w-12" />
						</th>
						<th className={`${th} ${tablet} pl-8`}>
							<Skeleton className="h-3 w-16" />
						</th>
						<th className={`${th} ${desktop}`}>
							<Skeleton className="h-3 w-14" />
						</th>
					</tr>
				</thead>
				<tbody>
					{range(rows).map((i) => (
						<tr key={i} className={tr}>
							<td className={td}>
								<span className="flex items-center gap-1.5">
									<Skeleton className="h-4 w-14" />
									<Skeleton className="h-4 w-10" />
								</span>
							</td>
							<td className={td}>
								<span className="flex items-center gap-3">
									<Skeleton className="size-9 shrink-0 rounded-lg" />
									<span className="min-w-0">
										<Skeleton className="h-4" style={{ width: [128, 96, 152, 112, 80, 140, 104, 120][i % 8] }} />
										{i % 4 === 0 ? <Skeleton className="mt-1.5 h-3 w-36" /> : null}
									</span>
								</span>
							</td>
							<td className={td}>
								<Skeleton className="h-6 w-14 rounded-lg" />
							</td>
							<td className={td}>
								<Skeleton className="ml-auto h-4 w-8" />
								{i % 5 === 2 ? <Skeleton className="mt-1 ml-auto h-3 w-14" /> : null}
							</td>
							<td className={`${td} ${tablet}`}>
								<Skeleton className="ml-auto h-4 w-24" />
							</td>
							<td className={`${td} ${tablet} pl-8`}>
								<Skeleton className="h-4" style={{ width: [64, 80, 56][i % 3] }} />
							</td>
							<td className={`${td} ${desktop}`}>
								{i % 3 === 1 ? (
									<Skeleton className="h-4 w-4" />
								) : (
									<Skeleton className="h-4" style={{ width: [160, 112, 192, 136][i % 4] }} />
								)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

/** The history page: back button beside the title (no tabs, no action), then the filtered table card. */
export function StockHistorySkeleton() {
	return (
		<PageContainer>
			<div className="flex items-center gap-3" aria-hidden>
				<Skeleton className="size-9 shrink-0 rounded-lg" />
				<div className="min-w-0">
					<div className="flex h-8 items-center">
						<Skeleton className="h-7 w-48" />
					</div>
					<div className="flex h-5 items-center">
						<Skeleton className="h-4 w-64 max-w-full" />
					</div>
				</div>
			</div>
			<div className="surface overflow-hidden rounded-2xl">
				<FilterBarSkeleton chips={["w-20", "w-24"]} />
				<StockHistoryRowsSkeleton />
				<PagerSkeleton />
			</div>
		</PageContainer>
	);
}
