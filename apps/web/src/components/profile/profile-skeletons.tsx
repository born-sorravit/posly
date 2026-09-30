import { PageContainer } from "@/components/common/primitives";
import { Skeleton } from "@posly/ui/components/skeleton";

/** A label over an `h-11` input, with an optional hint line under it (`Field`). */
function FieldSkeleton({ label = "w-24", hint = false }: { label?: string; hint?: boolean }) {
	return (
		<div className="space-y-1.5">
			<Skeleton className={`h-3.5 ${label}`} />
			<Skeleton className="h-11 w-full rounded-xl" />
			{hint ? <Skeleton className="h-3 w-3/5" /> : null}
		</div>
	);
}

/** The form's save button: full width on a phone, a normal button from tablet up. */
function SaveSkeleton() {
	return (
		<div className="flex justify-end">
			<Skeleton className="h-11 w-full rounded-lg tablet:h-9 tablet:w-28" />
		</div>
	);
}

/** A section title with its one-line hint. */
function SectionHeadSkeleton({ title = "w-32", hint = "w-72" }: { title?: string; hint?: string }) {
	return (
		<div className="space-y-2">
			<Skeleton className={`h-5 ${title}`} />
			<Skeleton className={`h-4 max-w-full ${hint}`} />
		</div>
	);
}

/**
 * The profile page: title and description, then the three cards — the details card with its
 * avatar strip and name / email fields, the PIN row, and the password form.
 */
export function ProfileSkeleton() {
	return (
		<PageContainer className="max-w-3xl">
			<div className="space-y-2" aria-hidden>
				<Skeleton className="h-7 w-28" />
				<Skeleton className="h-4 w-72 max-w-full" />
			</div>
			<div className="surface rounded-2xl" aria-hidden>
				<div className="flex items-center gap-4 border-b px-5 py-4">
					<Skeleton className="size-14 shrink-0 rounded-full" />
					<div className="min-w-0 space-y-2">
						<Skeleton className="h-5 w-36" />
						<Skeleton className="h-4 w-44" />
					</div>
				</div>
				<div className="space-y-4 p-5">
					<div className="grid gap-4 tablet:grid-cols-2">
						<FieldSkeleton label="w-12" />
						<FieldSkeleton label="w-14" hint />
					</div>
					<SaveSkeleton />
				</div>
			</div>
			<div className="surface space-y-5 rounded-2xl p-5" aria-hidden>
				<SectionHeadSkeleton title="w-36" hint="w-80" />
				<PinRowSkeleton />
			</div>
			<div className="surface space-y-5 rounded-2xl p-5" aria-hidden>
				<SectionHeadSkeleton title="w-28" hint="w-64" />
				<div className="space-y-4">
					<FieldSkeleton label="w-28" />
					<div className="grid gap-4 tablet:grid-cols-2">
						<FieldSkeleton label="w-24" hint />
						<FieldSkeleton label="w-28" />
					</div>
					<SaveSkeleton />
				</div>
			</div>
		</PageContainer>
	);
}

/** The PIN status row: key circle, two lines, and the set / change button. */
export function PinRowSkeleton() {
	return (
		<div className="flex items-center gap-4 rounded-xl bg-muted/50 p-4" aria-hidden>
			<Skeleton className="size-10 shrink-0 rounded-full" />
			<div className="min-w-0 flex-1 space-y-1.5">
				<Skeleton className="h-4 w-24" />
				<Skeleton className="h-3 w-48 max-w-full" />
			</div>
			<Skeleton className="h-8 w-20 shrink-0 rounded-lg" />
		</div>
	);
}
