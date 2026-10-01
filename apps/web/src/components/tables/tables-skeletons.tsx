import { PageContainer } from "@/components/common/primitives";
import { HeaderSkeleton } from "@/components/common/page-skeletons";
import { Skeleton } from "@posly/ui/components/skeleton";

/** The floor's grid of table cards. */
export function TableGridSkeleton() {
	return (
		<div className="grid grid-cols-2 gap-3 tablet:grid-cols-4 desktop:grid-cols-5 desktop:gap-4">
			{Array.from({ length: 10 }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
				<Skeleton key={i} className="h-36 rounded-2xl" />
			))}
		</div>
	);
}

export function TablesPageSkeleton() {
	return (
		<PageContainer>
			<HeaderSkeleton />
			<TableGridSkeleton />
		</PageContainer>
	);
}

/** Settings → Tables: the card of table rows. */
export function TableSettingsSkeleton() {
	return (
		<div className="surface space-y-3 rounded-2xl p-5">
			<div className="flex items-center justify-between">
				<Skeleton className="h-5 w-24" />
				<Skeleton className="h-9 w-28 rounded-lg" />
			</div>
			<Skeleton className="h-4 w-72" />
			{Array.from({ length: 4 }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
				<Skeleton key={i} className="h-14 w-full rounded-xl" />
			))}
		</div>
	);
}
