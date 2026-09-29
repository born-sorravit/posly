import { ChartSkeleton, MetricSkeleton, PageContainer } from "@/components/common/primitives";
import { Skeleton } from "@posly/ui/components/skeleton";

/*
 * Route-level loading states. Each one is the shape of the page it stands in for, so the
 * layout does not jump when the real page lands (plan §31: grey shapes, never a spinner).
 */

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

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

/** Hero greeting, eight metrics, then the chart and its side panel. */
export function DashboardSkeleton() {
	return (
		<PageContainer>
			<Skeleton className="h-36 w-full rounded-3xl" />
			<div className="grid grid-cols-2 gap-3 desktop:grid-cols-4 desktop:gap-4">
				{range(4).map((i) => (
					<MetricSkeleton key={i} />
				))}
			</div>
			<div className="grid gap-4 desktop:grid-cols-5">
				<ChartSkeleton className="desktop:col-span-3" />
				<div className="surface space-y-4 rounded-2xl p-5 desktop:col-span-2">
					<Skeleton className="h-5 w-32" />
					{range(5).map((i) => (
						<div key={i} className="flex items-center gap-3">
							<Skeleton className="size-9 rounded-lg" />
							<Skeleton className="h-4 flex-1" />
							<Skeleton className="h-4 w-14" />
						</div>
					))}
				</div>
			</div>
		</PageContainer>
	);
}

/** Range picker, metrics, chart, then the period table. */
export function ReportsSkeleton() {
	return (
		<PageContainer>
			<HeaderSkeleton action={false} />
			<Skeleton className="h-9 w-72 rounded-lg" />
			<div className="grid grid-cols-2 gap-3 desktop:grid-cols-4">
				{range(4).map((i) => (
					<MetricSkeleton key={i} />
				))}
			</div>
			<ChartSkeleton />
			<TableCardSkeleton rows={6} thumb={false} />
		</PageContainer>
	);
}

/** One settings panel: label/field pairs and the save button (the tab rail stays rendered). */
export function SettingsSkeleton() {
	return (
		<>
			<div className="surface space-y-6 rounded-2xl p-6">
				<Skeleton className="h-5 w-40" />
				{range(4).map((i) => (
					<div key={i} className="space-y-2">
						<Skeleton className="h-4 w-28" />
						<Skeleton className="h-11 w-full rounded-xl" />
					</div>
				))}
			</div>
			<div className="flex justify-end">
				<Skeleton className="h-10 w-28 rounded-lg" />
			</div>
		</>
	);
}
