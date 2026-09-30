import { range } from "@/components/common/skeleton-text";
import { PageContainer } from "@/components/common/primitives";
import { Skeleton } from "@posly/ui/components/skeleton";

/*
 * Loading shapes for the customers and employees pages. Server-safe (no hooks), so the route
 * `loading.tsx` files and the views' pending branches draw the same thing.
 */


const NAME_WIDTHS = [112, 84, 136, 96, 120, 72, 104, 128];
const SUB_WIDTHS = [96, 120, 88, 132, 100, 112, 80, 124];

/** `PageHeader`: title and description, stacked over the actions on a phone. */
function PeopleHeaderSkeleton({ actions }: { actions: string[] }) {
	return (
		<div className="flex flex-col gap-3 tablet:flex-row tablet:items-end tablet:justify-between">
			<div className="space-y-2">
				<Skeleton className="h-7 w-28" />
				<Skeleton className="h-4 w-60" />
			</div>
			<div className="flex flex-wrap items-center gap-2">
				{actions.map((w, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static header buttons
					<Skeleton key={i} className={`h-9 rounded-lg ${w}`} />
				))}
			</div>
		</div>
	);
}

/** A round avatar beside a name and a smaller second line, as in both people tables. */
function PersonCell({ i, avatar = "size-9" }: { i: number; avatar?: string }) {
	return (
		<span className="flex items-center gap-3">
			<Skeleton className={`shrink-0 rounded-full ${avatar}`} />
			<span className="min-w-0">
				<Skeleton className="h-3.5" style={{ width: NAME_WIDTHS[i % 8] }} />
				<Skeleton className="mt-1.5 h-3" style={{ width: SUB_WIDTHS[i % 8] }} />
			</span>
		</span>
	);
}

const th = "h-10 border-border border-b px-3 first:pl-5 last:pr-5";
const td = "h-14 px-3 first:pl-5 last:pr-5";
const row = "[&:not(:last-child)>td]:border-border/50 [&:not(:last-child)>td]:border-b";

/**
 * The customers `DataTable` (no phone list): name with avatar and phone, orders and spending
 * on the right, last visit from tablet up, then the row menu.
 */
export function CustomerRowsSkeleton({ rows = 8 }: { rows?: number }) {
	return (
		<div className="overflow-x-auto" aria-hidden>
			<table className="w-full border-separate border-spacing-0 text-sm">
				<thead>
					<tr>
						<th className={th}>
							<Skeleton className="h-3 w-12" />
						</th>
						<th className={th}>
							<Skeleton className="ml-auto h-3 w-12" />
						</th>
						<th className={th}>
							<Skeleton className="ml-auto h-3 w-14" />
						</th>
						<th className={`${th} hidden pl-8 tablet:table-cell`}>
							<Skeleton className="h-3 w-16" />
						</th>
						<th className={`${th} w-12`} />
					</tr>
				</thead>
				<tbody>
					{range(rows).map((i) => (
						<tr key={i} className={row}>
							<td className={td}>
								<PersonCell i={i} />
							</td>
							<td className={td}>
								<Skeleton className="ml-auto h-4 w-6" />
							</td>
							<td className={td}>
								<Skeleton className="ml-auto h-4" style={{ width: [64, 52, 72, 48, 60, 56, 68, 44][i % 8] }} />
							</td>
							<td className={`${td} hidden pl-8 tablet:table-cell`}>
								<Skeleton className="h-4" style={{ width: [80, 64, 96, 72, 88, 60, 76, 92][i % 8] }} />
							</td>
							<td className={`${td} w-12`}>
								<Skeleton className="ml-auto size-7 rounded-lg" />
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

/** Customers: header with the add button, then the list card with a search-only toolbar. */
export function CustomersSkeleton() {
	return (
		<PageContainer>
			<PeopleHeaderSkeleton actions={["w-32"]} />
			<div className="surface overflow-hidden rounded-2xl" aria-hidden>
				{/* `FilterBar`: the empty filter slot still adds its gap under the search on a phone. */}
				<div className="flex flex-col gap-2 border-border/60 border-b px-4 py-3 tablet:flex-row tablet:items-center">
					<Skeleton className="h-8 w-full rounded-md tablet:w-72" />
					<div className="flex flex-wrap items-center gap-2" />
				</div>
				<CustomerRowsSkeleton />
			</div>
		</PageContainer>
	);
}

/**
 * The staff table. A phone gets `mobileRow`'s list: avatar, name and email, the role badge and
 * the menu slot (empty for the owner). From tablet up: name, role, status, orders today, menu.
 */
export function EmployeeRowsSkeleton({ rows = 4 }: { rows?: number }) {
	const role = [56, 64, 72, 60];
	return (
		<div aria-hidden>
			<ul className="divide-y divide-border/50 tablet:hidden">
				{range(rows).map((i) => (
					<li key={i} className="px-4 py-3">
						<div className="flex items-center gap-3">
							<Skeleton className="size-10 shrink-0 rounded-full" />
							<div className="min-w-0 flex-1">
								<Skeleton className="h-3.5" style={{ width: NAME_WIDTHS[i % 8] }} />
								<Skeleton className="mt-1.5 h-3" style={{ width: SUB_WIDTHS[i % 8] }} />
							</div>
							<Skeleton className="h-6 shrink-0 rounded-lg" style={{ width: role[i % 4] }} />
							<div className="-mr-1.5 flex w-8 shrink-0 justify-center">
								{i === 0 ? null : <Skeleton className="size-7 rounded-lg" />}
							</div>
						</div>
					</li>
				))}
			</ul>
			<div className="hidden overflow-x-auto tablet:block">
				<table className="w-full border-separate border-spacing-0 text-sm">
					<thead>
						<tr>
							<th className={th}>
								<Skeleton className="h-3 w-12" />
							</th>
							<th className={th}>
								<Skeleton className="h-3 w-12" />
							</th>
							<th className={`${th} hidden tablet:table-cell`}>
								<Skeleton className="h-3 w-12" />
							</th>
							<th className={`${th} hidden tablet:table-cell`}>
								<Skeleton className="ml-auto h-3 w-20" />
							</th>
							<th className={`${th} w-12`} />
						</tr>
					</thead>
					<tbody>
						{range(rows).map((i) => (
							<tr key={i} className={row}>
								<td className={td}>
									<PersonCell i={i} />
								</td>
								<td className={td}>
									<Skeleton className="h-6 rounded-lg" style={{ width: role[i % 4] }} />
								</td>
								<td className={`${td} hidden tablet:table-cell`}>
									<Skeleton className="h-4" style={{ width: [72, 88, 64, 80][i % 4] }} />
								</td>
								<td className={`${td} hidden tablet:table-cell`}>
									<Skeleton className="ml-auto h-4 w-6" />
								</td>
								<td className={`${td} w-12`}>
									{i === 0 ? null : <Skeleton className="ml-auto size-7 rounded-lg" />}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

/** Employees: header with switch-user and invite, then the staff card (no toolbar). */
export function EmployeesSkeleton() {
	return (
		<PageContainer>
			<PeopleHeaderSkeleton actions={["w-32", "w-32"]} />
			<div className="surface rounded-2xl">
				<EmployeeRowsSkeleton />
			</div>
		</PageContainer>
	);
}
