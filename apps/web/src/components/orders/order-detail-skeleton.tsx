import { range } from "@/components/common/skeleton-text";
import { PageContainer } from "@/components/common/primitives";
import { Skeleton } from "@posly/ui/components/skeleton";


/** One `Row` of a `dl`: label on the left, value on the right. */
function RowSkeleton({ label, value }: { label: number; value: number }) {
	return (
		<div className="flex h-9 items-center justify-between gap-4">
			<Skeleton className="h-4" style={{ width: label }} />
			<Skeleton className="h-4" style={{ width: value }} />
		</div>
	);
}

/** `SectionTitle`: a 24px line and its bottom margin. */
function TitleSkeleton({ width }: { width: string }) {
	return (
		<div className="mb-4 flex h-6 items-center">
			<Skeleton className={`h-5 ${width}`} />
		</div>
	);
}

/**
 * One order: back button, number with its status badge and the time, the four actions
 * (send, print, refund, cancel); then the items card with totals beside the payment and
 * audit cards (stacked below desktop).
 */
export function OrderDetailSkeleton() {
	return (
		<PageContainer className="max-w-5xl">
			<div className="flex flex-col gap-4 tablet:flex-row tablet:items-center tablet:justify-between" aria-hidden>
				<div className="flex items-center gap-3">
					<Skeleton className="size-9 shrink-0 rounded-lg" />
					<div className="space-y-1">
						<div className="flex h-8 items-center gap-3">
							<Skeleton className="h-7 w-20" />
							<Skeleton className="h-6 w-20 rounded-lg" />
						</div>
						<Skeleton className="h-4 w-36" />
					</div>
				</div>
				<div className="flex flex-wrap gap-2">
					{["w-28", "w-24", "w-24", "w-24"].map((w, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static header buttons
						<Skeleton key={i} className={`h-9 rounded-lg ${w}`} />
					))}
				</div>
			</div>

			<div className="grid gap-4 desktop:grid-cols-3" aria-hidden>
				<div className="surface rounded-2xl p-5 desktop:col-span-2">
					<TitleSkeleton width="w-20" />
					<ul className="divide-y">
						{range(3).map((i) => (
							<li key={i} className="flex items-center gap-3 py-3">
								<Skeleton className="size-11 shrink-0 rounded-lg" />
								<div className="min-w-0 flex-1 space-y-1.5">
									<Skeleton className="h-4" style={{ width: `${[42, 30, 36][i]}%` }} />
									<Skeleton className="h-3" style={{ width: `${[22, 16, 28][i]}%` }} />
								</div>
								<Skeleton className="h-4 w-6" />
								<Skeleton className="h-4 w-16" />
							</li>
						))}
					</ul>
					<div className="mt-2 border-t pt-2">
						<RowSkeleton label={72} value={64} />
						<RowSkeleton label={40} value={52} />
						<div className="flex items-center justify-between pt-2">
							<Skeleton className="h-5 w-16" />
							<Skeleton className="h-8 w-28" />
						</div>
					</div>
				</div>

				<div className="grid content-start gap-4">
					<div className="surface rounded-2xl p-5">
						<TitleSkeleton width="w-24" />
						<div className="divide-y">
							{[
								[64, 72],
								[56, 56],
								[48, 44],
								[64, 80],
								[56, 24],
							].map(([label, value], i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
								<RowSkeleton key={i} label={label} value={value} />
							))}
						</div>
					</div>
					<div className="surface rounded-2xl p-5">
						<TitleSkeleton width="w-28" />
						<div className="flex gap-3">
							<Skeleton className="mt-0.5 size-4 shrink-0 rounded" />
							<div className="space-y-1.5">
								<Skeleton className="h-4 w-40" />
								<Skeleton className="h-3 w-28" />
							</div>
						</div>
					</div>
				</div>
			</div>
		</PageContainer>
	);
}
