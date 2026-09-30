import { PageHeaderSkeleton, range } from "@/components/common/skeleton-text";
import { PageContainer } from "@/components/common/primitives";
import { Skeleton } from "@posly/ui/components/skeleton";

/*
 * Loading shapes for the catalog screens (categories, option groups, recipes). Server-safe, so
 * the route `loading.tsx` files and the views' pending branches draw the same thing.
 */


/** Category rows as the list draws them: grip, icon chip, name over count, the kitchen chip, the switch. */
export function CategoryRowsSkeleton({ rows = 5, kitchen = false }: { rows?: number; kitchen?: boolean }) {
	return (
		<div className="grid gap-1" aria-hidden>
			{range(rows).map((i) => (
				<div key={i} className="flex items-center gap-3 rounded-xl p-3">
					<Skeleton className="size-4 shrink-0 rounded" />
					<Skeleton className="size-10 shrink-0 rounded-xl" />
					<div className="min-w-0 flex-1 space-y-1">
						<Skeleton className="my-1 h-4" style={{ width: [112, 88, 136, 72, 104][i % 5] }} />
						<Skeleton className="my-0.5 h-3 w-16" />
					</div>
					{kitchen ? <Skeleton className="h-6 w-16 shrink-0 rounded-full" /> : null}
					<Skeleton className="h-[18.4px] w-8 shrink-0 rounded-full" />
				</div>
			))}
		</div>
	);
}

/** The categories page: narrow column, header with the add button, the list card, the drag hint. */
export function CategoriesSkeleton() {
	return (
		<PageContainer className="max-w-3xl">
			<PageHeaderSkeleton title="w-28" description="w-80" actions={["w-32"]} />
			<div className="surface rounded-2xl p-2">
				<CategoryRowsSkeleton />
			</div>
			<Skeleton className="my-0.5 h-4 w-72 max-w-full" />
		</PageContainer>
	);
}

/** Option-chip widths per card, so the four cards do not look stamped from one mould. */
const OPTION_WIDTHS = [
	[56, 64, 52],
	[72, 60, 68, 48, 64],
	[64, 80],
	[52, 72, 60, 56],
];

/** Option-group cards: name, choice and required badges, the ⋯ button, option chips, then "used by". */
export function ModifierGroupsSkeleton({ cards = 4 }: { cards?: number }) {
	return (
		<div className="grid gap-4 tablet:grid-cols-2" aria-hidden>
			{range(cards).map((i) => (
				<div key={i} className="surface flex flex-col gap-4 rounded-2xl p-5">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0">
							<Skeleton className="my-1 h-4" style={{ width: [96, 120, 80, 108][i % 4] }} />
							<div className="mt-1 flex gap-1.5">
								<Skeleton className="h-6 w-16 rounded-lg" />
								{i % 2 === 0 ? <Skeleton className="h-6 w-14 rounded-lg" /> : null}
							</div>
						</div>
						<Skeleton className="size-7 shrink-0 rounded-lg" />
					</div>
					<div className="flex flex-wrap gap-1.5">
						{OPTION_WIDTHS[i % OPTION_WIDTHS.length].map((width, j) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder chips; widths may repeat
							<Skeleton key={j} className="h-7 rounded-lg" style={{ width }} />
						))}
					</div>
					<Skeleton className="mt-auto h-3 w-24" />
				</div>
			))}
		</div>
	);
}

/** The option groups page: header with the add button over the card grid. */
export function ModifiersSkeleton() {
	return (
		<PageContainer>
			<PageHeaderSkeleton title="w-32" description="w-96" actions={["w-32"]} />
			<ModifierGroupsSkeleton />
		</PageContainer>
	);
}

/**
 * `RecipeEditor` while its recipe loads: ingredient picker, quantity, cost and remove per line
 * (a tinted block per line on a phone, one grid row from tablet), then "add line" and the total.
 */
export function RecipeLinesSkeleton({ lines = 2 }: { lines?: number }) {
	return (
		<div className="space-y-3" aria-hidden>
			<div className="grid gap-2">
				{range(lines).map((i) => (
					<div
						key={i}
						className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-xl bg-muted/50 p-2.5 tablet:grid-cols-[1fr_8rem_5.5rem_auto] tablet:bg-transparent tablet:p-0"
					>
						<Skeleton className="col-span-3 h-10 w-full rounded-lg tablet:col-span-1" />
						<Skeleton className="h-10 w-full rounded-lg" />
						<Skeleton className="ml-auto h-4 w-12" />
						<Skeleton className="size-7 rounded-lg" />
					</div>
				))}
			</div>
			<div className="flex items-center justify-between gap-3">
				<Skeleton className="h-7 w-28 rounded-lg" />
				<Skeleton className="h-4 w-24" />
			</div>
		</div>
	);
}
