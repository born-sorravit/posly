import { TextSkeleton, range } from "@/components/common/skeleton-text";
import { Skeleton } from "@posly/ui/components/skeleton";

/*
 * The till's loading shapes, used by pos/loading.tsx and by `PosScreen` while the menu loads.
 * Same containers, paddings and grid as the screen, so nothing moves when products land.
 * Server-safe.
 */

/** A bar on the cart's muted totals box, where the plain muted skeleton would vanish. */
const onMuted = "bg-foreground/10";

/**
 * One `ProductCard`: the 4:3 picture, then the name over the price beside the round "+".
 */
function ProductCardSkeleton({ name }: { name: number }) {
	return (
		<div className="surface flex flex-col gap-2 rounded-2xl p-2">
			<Skeleton className="aspect-[4/3] w-full rounded-xl" />
			<div className="flex items-end justify-between gap-2 px-1 pb-0.5">
				<div className="min-w-0 flex-1">
					<TextSkeleton box="h-[19px]" style={{ width: `${name}%` }} />
					<TextSkeleton className="w-12" />
				</div>
				<Skeleton className="size-8 shrink-0 rounded-full" />
			</div>
		</div>
	);
}

/** The product grid: two columns on a phone up to five on a wide screen. */
export function ProductGridSkeleton({ count = 12 }: { count?: number }) {
	return (
		<div
			className="grid grid-cols-2 gap-3 tablet:grid-cols-3 desktop:grid-cols-4 min-[1600px]:grid-cols-5"
			aria-hidden
		>
			{range(count).map((i) => (
				<ProductCardSkeleton key={i} name={[72, 56, 80, 64, 48, 76][i % 6]} />
			))}
		</div>
	);
}

/** The category chips (`Segmented` chips, `lg`): "all" first, then the shop's categories. */
export function CategoryChipsSkeleton() {
	return (
		<div className="no-scrollbar -mx-1 flex max-w-full items-center gap-1.5 overflow-x-auto px-1 py-1" aria-hidden>
			{[76, 88, 72, 96, 80, 68, 84].map((w, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder chips; widths repeat
				<Skeleton key={i} className="h-11 shrink-0 rounded-xl" style={{ width: w }} />
			))}
		</div>
	);
}

/**
 * `CartPanel` with an empty cart: title and customer button, the order-type pills and label
 * field, the empty state, then the totals box and the 56px checkout button.
 */
export function CartPanelSkeleton() {
	return (
		<div className="flex h-full min-h-0 flex-col" aria-hidden>
			<div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
				<div>
					<TextSkeleton box="h-6" bar="h-4" className="w-28" />
					<TextSkeleton box="h-4" bar="h-3" className="w-36" />
				</div>
				<Skeleton className="h-7 w-20 rounded-md" />
			</div>
			<div className="flex items-center gap-1.5 px-4 pb-2">
				{range(3).map((i) => (
					<Skeleton key={i} className="h-8 w-[4.5rem] shrink-0 rounded-full" />
				))}
				<Skeleton className="h-8 min-w-0 flex-1 rounded-full" />
			</div>
			<div className="min-h-0 flex-1 px-2">
				<div className="flex flex-col items-center gap-4 px-6 py-12">
					<Skeleton className="size-16 rounded-2xl" />
					<div className="flex flex-col items-center gap-1">
						<TextSkeleton box="h-6" bar="h-4" className="w-32" />
						<TextSkeleton className="w-48" />
					</div>
				</div>
			</div>
			<div className="m-2 space-y-3 rounded-2xl bg-muted/50 px-4 pt-3 pb-4 dark:bg-white/[0.03]">
				<div className="grid gap-1.5">
					<div className="flex h-5 items-center justify-between">
						<Skeleton className={`h-3.5 w-20 ${onMuted}`} />
						<Skeleton className={`h-3.5 w-12 ${onMuted}`} />
					</div>
					<div className="flex h-7 items-center justify-between">
						<Skeleton className={`h-7 w-24 rounded-md ${onMuted}`} />
					</div>
					<div className="flex items-center justify-between pt-1.5">
						<Skeleton className={`h-4 w-12 ${onMuted}`} />
						<Skeleton className={`h-7 w-24 ${onMuted}`} />
					</div>
				</div>
				<Skeleton className="h-14 w-full rounded-2xl" />
			</div>
		</div>
	);
}

/**
 * The whole till while the route loads: search, category chips and the product grid, with the
 * cart column beside them from tablet up. Same height rules as `PosScreen`, so the page never
 * scrolls on a phone.
 */
export function PosSkeleton() {
	return (
		<div className="-mb-24 flex h-[calc(100svh-8rem-env(safe-area-inset-bottom)-var(--demo-banner-h,0px))] overflow-hidden tablet:mb-0 tablet:h-[calc(100svh-4rem-var(--demo-banner-h,0px))]">
			<section className="flex min-w-0 flex-1 flex-col">
				<div className="space-y-3 px-4 pt-4 pb-3 desktop:px-6" aria-hidden>
					<div className="surface flex h-12 items-center gap-3 rounded-xl pl-3">
						<Skeleton className="size-4 shrink-0 rounded" />
						<Skeleton className="h-3.5 w-48" />
					</div>
					<CategoryChipsSkeleton />
				</div>
				<div className="min-h-0 flex-1 overflow-hidden px-4 pb-24 tablet:pb-6 desktop:px-6">
					<ProductGridSkeleton />
				</div>
			</section>
			<aside className="hidden w-[340px] shrink-0 py-3 pr-3 tablet:block desktop:w-[392px]">
				<div className="surface h-full overflow-hidden rounded-3xl">
					<CartPanelSkeleton />
				</div>
			</aside>
		</div>
	);
}
