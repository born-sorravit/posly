import { PageHeaderSkeleton, range } from "@/components/common/skeleton-text";
import { PageContainer } from "@/components/common/primitives";
import { Skeleton } from "@posly/ui/components/skeleton";

/*
 * Loading shapes for the product list and the product editor. Server-safe, so the route
 * `loading.tsx` files and the views' pending branches draw the same thing.
 */


/**
 * The product table's rows: a real table with the same cells as the products `DataTable` —
 * thumbnail with name over SKU, category, price, stock with its badge, status — hiding the
 * same columns the real one hides (category and stock below tablet, status below desktop),
 * then the "showing 1–20 of 57" footer line.
 */
export function ProductRowsSkeleton({ rows = 8 }: { rows?: number }) {
	const cell = "h-14 px-3 first:pl-5 last:pr-5";
	const th = "h-10 border-border border-b px-3 first:pl-5 last:pr-5";
	const tablet = "hidden tablet:table-cell";
	const desktop = "hidden desktop:table-cell";
	return (
		<div aria-hidden>
			<div className="overflow-x-auto">
				<table className="w-full border-separate border-spacing-0 text-sm">
					<thead>
						<tr>
							<th className={th}>
								<Skeleton className="h-3 w-14" />
							</th>
							<th className={`${th} ${tablet}`}>
								<Skeleton className="h-3 w-16" />
							</th>
							<th className={th}>
								<Skeleton className="ml-auto h-3 w-10" />
							</th>
							<th className={`${th} ${tablet}`}>
								<Skeleton className="ml-auto h-3 w-12" />
							</th>
							<th className={`${th} ${desktop}`}>
								<Skeleton className="h-3 w-12" />
							</th>
						</tr>
					</thead>
					<tbody>
						{range(rows).map((i) => (
							<tr key={i} className="[&:not(:last-child)>td]:border-border/50 [&:not(:last-child)>td]:border-b">
								<td className={cell}>
									<span className="flex items-center gap-3">
										<Skeleton className="size-10 shrink-0 rounded-lg" />
										<span className="min-w-0 space-y-1.5">
											<Skeleton className="h-4" style={{ width: [144, 104, 176, 88, 128, 160, 96, 136][i % 8] }} />
											<Skeleton className="h-3 w-14" />
										</span>
									</span>
								</td>
								<td className={`${cell} ${tablet}`}>
									<Skeleton className="h-4" style={{ width: [64, 80, 56, 72][i % 4] }} />
								</td>
								<td className={cell}>
									<Skeleton className="ml-auto h-4 w-14" />
								</td>
								<td className={`${cell} ${tablet}`}>
									<span className="flex items-center justify-end gap-2">
										<Skeleton className="h-4 w-12" />
										<Skeleton className="h-6 w-16 rounded-lg" />
									</span>
								</td>
								<td className={`${cell} ${desktop}`}>
									<Skeleton className="h-6 w-16 rounded-lg" />
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<div className="flex flex-col items-center justify-between gap-3 px-5 py-4 tablet:flex-row">
				<Skeleton className="my-0.5 h-4 w-40" />
			</div>
		</div>
	);
}

/**
 * The products page: header with the add button, then the table card — search, the category
 * chip and, pushed right from tablet up, the sort menu — over the rows.
 */
export function ProductsSkeleton() {
	return (
		<PageContainer>
			<PageHeaderSkeleton title="w-24" description="w-48" actions={["w-32"]} />
			<div className="surface overflow-hidden rounded-2xl" aria-hidden>
				<div className="flex flex-col gap-2 border-border/60 border-b px-4 py-3 tablet:flex-row tablet:items-center">
					<Skeleton className="h-8 w-full rounded-md tablet:w-72" />
					<div className="flex flex-wrap items-center gap-2">
						<Skeleton className="h-8 w-24 rounded-md" />
					</div>
					<div className="flex items-center gap-2 tablet:ml-auto">
						<Skeleton className="h-8 w-36 rounded-md" />
					</div>
				</div>
				<ProductRowsSkeleton />
			</div>
		</PageContainer>
	);
}

/** A form field: its 14px label over an `h-11` input, and the hint line when the field has one. */
function FieldSkeleton({ label = "w-20", hint = false }: { label?: string; hint?: boolean }) {
	return (
		<div className="space-y-1.5">
			<Skeleton className={`h-3.5 ${label}`} />
			<Skeleton className="h-11 w-full rounded-xl" />
			{hint ? <Skeleton className="my-0.5 h-3 w-40" /> : null}
		</div>
	);
}

/** `SectionTitle`: a 24px heading line with its bottom margin, and an optional action on the right. */
function SectionTitleSkeleton({ width = "w-28", action }: { width?: string; action?: string }) {
	return (
		<div className="mb-4 flex items-center justify-between gap-3">
			<Skeleton className={`my-1 h-4 ${width}`} />
			{action ? <Skeleton className={`h-7 rounded-lg ${action}`} /> : null}
		</div>
	);
}

/** A card heading that is a bold line over a muted hint (stock tracking, recipe). */
function CardHeadingSkeleton({ title = "w-32", hint = "w-64" }: { title?: string; hint?: string }) {
	return (
		<div className="min-w-0 space-y-1">
			<Skeleton className={`my-1 h-4 ${title}`} />
			<Skeleton className={`my-0.5 h-4 max-w-full ${hint}`} />
		</div>
	);
}

/**
 * The product editor: back button and title with delete / save, then the two-thirds column —
 * details (name, then six fields in pairs), the recipe card when recipes are on, stock
 * tracking, option groups — beside the image card, which drops below it under desktop.
 */
export function ProductFormSkeleton({
	edit = false,
	recipes = false,
	actions = true,
}: {
	/** An existing product: the header carries a delete button too. */
	edit?: boolean;
	/** The shop costs products by recipe, so the recipe card shows. */
	recipes?: boolean;
	/** False for someone who may only look: no header buttons. */
	actions?: boolean;
}) {
	return (
		<PageContainer className="max-w-5xl">
			<div className="space-y-6" aria-hidden>
				<div className="flex items-center justify-between gap-3">
					<div className="flex items-center gap-3">
						<Skeleton className="size-9 shrink-0 rounded-lg" />
						<Skeleton className="my-1 h-6 w-44" />
					</div>
					{actions ? (
						<div className="flex gap-2">
							{edit ? <Skeleton className="h-9 w-9 rounded-lg tablet:w-16" /> : null}
							<Skeleton className="h-9 w-28 rounded-lg" />
						</div>
					) : null}
				</div>

				<div className="grid gap-4 desktop:grid-cols-3">
					<div className="space-y-4 desktop:col-span-2">
						<div className="surface space-y-4 rounded-2xl p-5">
							<SectionTitleSkeleton width="w-24" />
							<FieldSkeleton label="w-16" />
							<div className="grid gap-4 tablet:grid-cols-2">
								<FieldSkeleton label="w-14" />
								<FieldSkeleton label="w-12" />
								<FieldSkeleton label="w-16" />
								<FieldSkeleton label="w-14" hint />
								<FieldSkeleton label="w-20" />
								<FieldSkeleton label="w-16" />
							</div>
						</div>

						{recipes && actions ? (
							<div className="surface space-y-4 rounded-2xl p-5">
								<div className="flex flex-col gap-3 tablet:flex-row tablet:items-start tablet:justify-between">
									<CardHeadingSkeleton title="w-28" hint="w-72" />
									<Skeleton className="h-9 w-48 shrink-0 rounded-lg" />
								</div>
							</div>
						) : null}

						<div className="surface space-y-4 rounded-2xl p-5">
							<div className="flex items-center justify-between gap-4">
								<CardHeadingSkeleton title="w-28" hint="w-60" />
								<Skeleton className="h-[18.4px] w-8 shrink-0 rounded-full" />
							</div>
						</div>

						<div className="surface rounded-2xl p-5">
							<SectionTitleSkeleton width="w-32" action={actions ? "w-28" : undefined} />
							<Skeleton className="mb-4 h-4 w-72 max-w-full" />
							<div className="grid gap-2">
								{range(3).map((i) => (
									<div key={i} className="flex items-start gap-3 rounded-xl border p-3">
										<Skeleton className="mt-0.5 size-4 shrink-0 rounded" />
										<div className="min-w-0 flex-1">
											<div className="flex items-center justify-between gap-2">
												<Skeleton className="my-0.5 h-4" style={{ width: [80, 104, 72][i] }} />
												<Skeleton className="h-3 w-24 shrink-0" />
											</div>
											<Skeleton className="mt-1.5 mb-0.5 h-3" style={{ width: `${[60, 45, 70][i]}%` }} />
										</div>
									</div>
								))}
							</div>
						</div>
					</div>

					<div className="surface h-fit space-y-3 rounded-2xl p-5">
						<SectionTitleSkeleton width="w-16" />
						<Skeleton className="aspect-square w-full rounded-2xl" />
						<Skeleton className="h-3 w-4/5" />
					</div>
				</div>
			</div>
		</PageContainer>
	);
}
