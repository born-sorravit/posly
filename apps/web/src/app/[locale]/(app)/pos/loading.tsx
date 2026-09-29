import { ProductCardSkeleton } from "@/components/common/primitives";
import { Skeleton } from "@posly/ui/components/skeleton";

export default function PosLoading() {
	return (
		<div className="flex flex-1">
			<div className="flex-1 space-y-3 p-4 desktop:px-6">
				<Skeleton className="h-12 w-full rounded-xl" />
				<div className="flex gap-2">
					{/* Widths repeat, so they cannot be the key; the list is static, so the index can. */}
					{[64, 56, 48, 72, 56].map((w, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder chips
						<Skeleton key={i} className="h-11 rounded-xl" style={{ width: w }} />
					))}
				</div>
				<div className="grid grid-cols-2 gap-3 tablet:grid-cols-3 desktop:grid-cols-4">
					{Array.from({ length: 8 }, (_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
						<ProductCardSkeleton key={i} />
					))}
				</div>
			</div>
			<div className="surface m-3 hidden w-[340px] space-y-3 rounded-3xl p-4 tablet:block desktop:w-[380px]">
				<Skeleton className="h-6 w-32" />
				<Skeleton className="h-16 w-full rounded-2xl" />
				<Skeleton className="h-16 w-full rounded-2xl" />
			</div>
		</div>
	);
}
