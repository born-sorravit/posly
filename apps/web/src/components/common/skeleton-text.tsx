import { cn } from "@/lib/utils";
import { Skeleton } from "@posly/ui/components/skeleton";
import type { CSSProperties } from "react";

/**
 * One line of text while it loads: a bar inside a box the height of the real line, so the
 * skeleton takes the same room as the words. `box` is the line height (`h-5` for `text-sm`,
 * `h-4` for `text-xs`, `h-6` for `text-base`), `bar` the glyph height, `className` the width.
 */
export function TextSkeleton({
	className,
	box = "h-5",
	bar = "h-3.5",
	style,
}: {
	className?: string;
	box?: string;
	bar?: string;
	style?: CSSProperties;
}) {
	return (
		<div className={cn("flex items-center", box)}>
			<Skeleton className={cn(bar, className)} style={style} />
		</div>
	);
}

/** `[0, 1, …, n - 1]`, for static placeholder lists. */
export const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** `PageHeader`: a 32px title over a 20px description, with `size="lg"` actions to the right from tablet up. */
export function PageHeaderSkeleton({
	title = "w-40",
	description = "w-64",
	actions = [],
}: {
	title?: string;
	description?: string;
	/** Width of each header button, left to right. */
	actions?: string[];
}) {
	return (
		<div className="flex flex-col gap-3 tablet:flex-row tablet:items-end tablet:justify-between" aria-hidden>
			<div className="min-w-0 space-y-1">
				<div className="flex h-8 items-center">
					<Skeleton className={cn("h-7", title)} />
				</div>
				<div className="flex h-5 items-center">
					<Skeleton className={cn("h-4 max-w-full", description)} />
				</div>
			</div>
			{actions.length ? (
				<div className="flex shrink-0 flex-wrap items-center gap-2">
					{actions.map((w, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder buttons
						<Skeleton key={i} className={cn("h-9 rounded-lg", w)} />
					))}
				</div>
			) : null}
		</div>
	);
}
