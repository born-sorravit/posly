import { range } from "@/components/common/skeleton-text";
import { PageContainer } from "@/components/common/primitives";
import { Skeleton } from "@posly/ui/components/skeleton";


/**
 * `NotificationList` rows while they load: the tinted kind chip, a title over one or two lines
 * of body, and the time on the right. Server-safe, shared by the popover and the page.
 */
export function NotificationRowsSkeleton({ rows = 6 }: { rows?: number }) {
	return (
		<ul className="grid gap-0.5" aria-hidden>
			{range(rows).map((i) => (
				<li key={i} className="flex items-start gap-3 rounded-xl p-2.5">
					<Skeleton className="size-9 shrink-0 rounded-lg" />
					<div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
						<Skeleton className="h-3.5" style={{ width: `${[44, 58, 36, 52, 40, 48][i % 6]}%` }} />
						<Skeleton className="h-3" style={{ width: `${[86, 72, 92, 64, 80, 70][i % 6]}%` }} />
						{i % 3 === 0 ? <Skeleton className="h-3 w-2/5" /> : null}
					</div>
					<Skeleton className="mt-0.5 h-3 w-12 shrink-0" />
				</li>
			))}
		</ul>
	);
}

/** The notifications page: narrow column, title with "mark all read", then the list card. */
export function NotificationsSkeleton() {
	return (
		<PageContainer className="max-w-2xl">
			<div className="flex flex-col gap-3 tablet:flex-row tablet:items-end tablet:justify-between">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-4 w-28" />
			</div>
			<div className="surface rounded-2xl p-2">
				<NotificationRowsSkeleton />
			</div>
		</PageContainer>
	);
}
