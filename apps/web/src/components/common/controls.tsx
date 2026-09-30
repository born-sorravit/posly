"use client";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@posly/ui/components/dialog";
import { Button } from "@posly/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@posly/ui/components/dropdown-menu";
import { formatNumber } from "@posly/utils/format";
import type { Tone } from "@posly/types/domain";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	CircleHelp,
	type LucideIcon,
	Search,
	TriangleAlert,
	X,
} from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Fragment, forwardRef, type ReactNode, useId } from "react";

/**
 * Sub-pages of one page ("สินค้า / วัตถุดิบ" under stock): real links with an underline on
 * the current one. `Segmented` is for switching a value on the page, not for going elsewhere.
 */
export function PageTabs({
	tabs,
	className,
}: {
	tabs: { href: string; label: ReactNode; icon?: LucideIcon }[];
	className?: string;
}) {
	const pathname = usePathname();
	return (
		<nav className={cn("no-scrollbar flex gap-6 overflow-x-auto border-border border-b", className)}>
			{tabs.map(({ href, label, icon: Icon }) => {
				const active = pathname === href;
				return (
					<Link
						key={href}
						href={href}
						aria-current={active ? "page" : undefined}
						className={cn(
							"-mb-px flex h-11 shrink-0 items-center gap-2 border-b-2 px-0.5 font-medium text-sm transition-colors",
							active
								? "border-primary text-foreground"
								: "border-transparent text-muted-foreground hover:text-foreground"
						)}
					>
						{Icon ? <Icon className={cn("size-4", active && "text-primary")} /> : null}
						{label}
					</Link>
				);
			})}
		</nav>
	);
}

/**
 * A single-choice pill row: date ranges, order filters, category chips. The selected pill
 * slides rather than jumps, and nothing else about it animates.
 */
export function Segmented<T extends string>({
	value,
	onChange,
	options,
	size = "md",
	className,
	variant = "track",
}: {
	value: T;
	onChange: (value: T) => void;
	options: { value: T; label: ReactNode }[];
	size?: "sm" | "md" | "lg";
	className?: string;
	/** `track` sits the pills on a muted rail; `chips` spaces them out as separate chips. */
	variant?: "track" | "chips";
}) {
	const id = useId();
	return (
		<div
			role="radiogroup"
			className={cn(
				"no-scrollbar flex max-w-full items-center overflow-x-auto",
				// Chips get a little breathing room inside the scroller: overflow clips box-shadows,
				// which is what cut the top edge off every chip.
				variant === "track" ? "gap-0.5 rounded-lg bg-muted/70 p-0.5" : "-mx-1 gap-1.5 px-1 py-1",
				className
			)}
		>
			{options.map((option) => {
				const selected = option.value === value;
				return (
					<button
						key={option.value}
						type="button"
						role="radio"
						aria-checked={selected}
						onClick={() => onChange(option.value)}
						className={cn(
							"touch-target relative shrink-0 whitespace-nowrap font-medium transition-colors",
							size === "sm" && "h-7 rounded-lg px-2.5 text-xs",
							size === "md" && "h-8 rounded-md px-3 text-sm",
							size === "lg" && "h-11 rounded-xl px-4 text-sm",
							variant === "chips" && !selected && "surface text-muted-foreground hover:text-foreground",
							variant === "track" && !selected && "text-muted-foreground hover:text-foreground",
							selected && (variant === "chips" ? "text-primary-foreground" : "text-foreground")
						)}
					>
						{selected ? (
							<motion.span
								layoutId={`seg-${id}`}
								className={cn(
									"absolute inset-0",
									size === "lg" ? "rounded-xl" : "rounded-md",
									// No outer glow: the chip row scrolls, and a scroller clips anything drawn outside
									// the chip — a glow comes out as a hard rectangle. A lit top edge stays inside.
									variant === "chips"
										? "brand-gradient shadow-[inset_0_1px_0_0_oklch(1_0_0/0.25)]"
										: "bg-card shadow-sm dark:bg-white/10"
								)}
								transition={{ type: "spring", stiffness: 600, damping: 40 }}
							/>
						) : null}
						<span className="relative">{option.label}</span>
					</button>
				);
			})}
		</div>
	);
}

export const SearchInput = forwardRef<
	HTMLInputElement,
	{
		value: string;
		onChange: (value: string) => void;
		placeholder?: string;
		className?: string;
		shortcut?: string;
		size?: "md" | "lg";
		/** `toolbar`: flat and 32px, to sit in a filter row beside `FilterMenu`s. */
		tone?: "surface" | "toolbar";
	}
>(function SearchInput({ value, onChange, placeholder, className, shortcut, size = "md", tone = "surface" }, ref) {
	return (
		<div className={cn("relative", className)}>
			<Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground" />
			<input
				maxLength={120}
				ref={ref}
				type="search"
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder={placeholder}
				className={cn(
					"w-full border-0 pr-10 pl-9 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40 [&::-webkit-search-cancel-button]:hidden",
					tone === "toolbar"
						? "h-8 rounded-md bg-muted/70 focus:bg-card"
						: cn("surface rounded-xl", size === "lg" ? "h-12" : "h-10")
				)}
			/>
			{value ? (
				<button
					type="button"
					onClick={() => onChange("")}
					className="-translate-y-1/2 absolute top-1/2 right-2 flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
					aria-label="clear"
				>
					<X className="size-4" />
				</button>
			) : shortcut ? (
				<kbd className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-2.5 hidden rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground tablet:block">
					{shortcut}
				</kbd>
			) : null}
		</div>
	);
});

/** Destructive or irreversible actions go through this, never a bare button (plan §32). */
/**
 * A yes/no question before something that cannot be undone. The icon says what kind of
 * action it is before the words do; the confirm button is solid red when it destroys.
 */
export function ConfirmDialog({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel,
	cancelLabel,
	destructive = false,
	icon: Icon = destructive ? TriangleAlert : CircleHelp,
	onConfirm,
	children,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: ReactNode;
	description?: ReactNode;
	confirmLabel: ReactNode;
	cancelLabel: ReactNode;
	destructive?: boolean;
	icon?: LucideIcon;
	onConfirm: () => void;
	children?: ReactNode;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="gap-0 p-6 sm:max-w-md" showCloseButton={false}>
				<div className="flex gap-4">
					<span
						className={cn(
							"flex size-10 shrink-0 items-center justify-center rounded-full",
							destructive ? "bg-danger/12 text-danger" : "bg-primary/12 text-primary"
						)}
						aria-hidden
					>
						<Icon className="size-5" />
					</span>
					<DialogHeader className="min-w-0 flex-1 gap-1.5 pt-1.5 text-left">
						<DialogTitle className="text-base leading-snug">{title}</DialogTitle>
						{description ? (
							<DialogDescription className="text-sm leading-relaxed">{description}</DialogDescription>
						) : null}
					</DialogHeader>
				</div>
				{children ? <div className="mt-5 sm:pl-14">{children}</div> : null}
				<div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
					<Button variant="outline" size="lg" className="sm:min-w-24" onClick={() => onOpenChange(false)}>
						{cancelLabel}
					</Button>
					<Button
						size="lg"
						className={cn("sm:min-w-24", destructive ? "bg-danger text-white hover:bg-danger/90" : "brand-gradient")}
						onClick={() => {
							onConfirm();
							onOpenChange(false);
						}}
					>
						{confirmLabel}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export interface Column<T> {
	key: string;
	header: ReactNode;
	cell: (row: T) => ReactNode;
	className?: string;
	/** Hidden below this breakpoint so a phone shows only what fits. */
	hideBelow?: "tablet" | "desktop";
	align?: "left" | "right";
}

/**
 * A light table: rows separated by hairlines, no cell borders, a hover tint, and the whole
 * row as the click target when `onRowClick` is given.
 *
 * With `mobileRow`, a phone gets a list of those rows instead of the table: columns that fit
 * side by side at 1280px do not fit at 390px, and hiding them only goes so far.
 */
export function DataTable<T>({
	columns,
	rows,
	rowKey,
	onRowClick,
	mobileRow,
	className,
}: {
	columns: Column<T>[];
	rows: T[];
	rowKey: (row: T) => string;
	onRowClick?: (row: T) => void;
	mobileRow?: (row: T) => ReactNode;
	className?: string;
}) {
	const hide = (c: Column<T>) =>
		c.hideBelow === "tablet"
			? "hidden tablet:table-cell"
			: c.hideBelow === "desktop"
				? "hidden desktop:table-cell"
				: "";

	return (
		<>
		{mobileRow ? (
			<ul className={cn("divide-y divide-border/50 tablet:hidden", className)}>
				{rows.map((row) => (
					<li
						key={rowKey(row)}
						onClick={onRowClick ? () => onRowClick(row) : undefined}
						className={cn("px-4 py-3", onRowClick && "cursor-pointer active:bg-muted/40")}
					>
						{mobileRow(row)}
					</li>
				))}
			</ul>
		) : null}
		<div className={cn("overflow-x-auto", mobileRow && "hidden tablet:block", className)}>
			<table className="w-full border-separate border-spacing-0 text-sm">
				<thead>
					<tr className="text-left text-muted-foreground text-xs">
						{columns.map((c) => (
							<th
								key={c.key}
								className={cn(
									"h-10 whitespace-nowrap border-border border-b px-3 font-medium first:pl-5 last:pr-5",
									c.align === "right" && "text-right",
									hide(c),
									c.className
								)}
							>
								{c.header}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<tr
							key={rowKey(row)}
							onClick={onRowClick ? () => onRowClick(row) : undefined}
							className={cn(
								// Separate borders live on cells: with border-spacing the row box draws none.
								"transition-colors hover:bg-muted/40 [&:not(:last-child)>td]:border-border/50 [&:not(:last-child)>td]:border-b",
								onRowClick && "cursor-pointer"
							)}
						>
							{columns.map((c) => (
								<td
									key={c.key}
									className={cn(
										"h-14 px-3 first:pl-5 last:pr-5",
										c.align === "right" && "text-right",
										hide(c),
										c.className
									)}
								>
									{c.cell(row)}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
		</>
	);
}

/** Page numbers to show: first, last, and a window around the current page, gaps as null. */
const pageWindow = (page: number, last: number): (number | null)[] => {
	const pages = new Set([1, last, page - 1, page, page + 1].filter((p) => p >= 1 && p <= last));
	const sorted = [...pages].sort((a, b) => a - b);
	return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? [null, p] : [p]));
};

/**
 * "แสดง 51–100 จาก 590" with previous / next and a short run of page numbers. Buttons, not
 * links: the page lives in component state, and a list that scrolls back to the top on every
 * page would lose the cashier's place.
 */
export function Pager({
	page,
	lastPage,
	total,
	onChange,
	labels,
	disabled = false,
}: {
	page: number;
	lastPage: number;
	total: number;
	onChange: (page: number) => void;
	labels: { showing: string; previous: string; next: string };
	disabled?: boolean;
}) {
	if (total === 0) return null;
	const button =
		"touch-target flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40";
	return (
		<div className="flex flex-col items-center justify-between gap-3 px-5 py-4 tablet:flex-row">
			<p className="numeric text-muted-foreground text-sm">{labels.showing}</p>
			{lastPage > 1 ? (
				<nav className="flex items-center gap-1" aria-label="pagination">
					<button
						type="button"
						className={cn(button, "text-muted-foreground hover:bg-muted hover:text-foreground")}
						disabled={disabled || page <= 1}
						onClick={() => onChange(page - 1)}
						aria-label={labels.previous}
					>
						<ChevronLeft className="size-4" />
					</button>
					{pageWindow(page, lastPage).map((p, i) =>
						p === null ? (
							// biome-ignore lint/suspicious/noArrayIndexKey: gaps have no identity of their own
							<span key={`gap-${i}`} className="px-1 text-muted-foreground">
								…
							</span>
						) : (
							<button
								key={p}
								type="button"
								aria-current={p === page ? "page" : undefined}
								disabled={disabled}
								onClick={() => onChange(p)}
								className={cn(
									button,
									"numeric",
									p === page
										? "brand-gradient text-primary-foreground shadow-[inset_0_1px_0_0_oklch(1_0_0/0.25)]"
										: "text-muted-foreground hover:bg-muted hover:text-foreground"
								)}
							>
								{p}
							</button>
						)
					)}
					<button
						type="button"
						className={cn(button, "text-muted-foreground hover:bg-muted hover:text-foreground")}
						disabled={disabled || page >= lastPage}
						onClick={() => onChange(page + 1)}
						aria-label={labels.next}
					>
						<ChevronRight className="size-4" />
					</button>
				</nav>
			) : null}
		</div>
	);
}

/** `Pager` wired to `usePagedRows`, with the generic "แสดง 1–20 จาก 57 รายการ" wording. */
export function PagedFooter({
	paged,
}: {
	paged: { page: number; lastPage: number; total: number; from: number; to: number; goTo: (page: number) => void };
}) {
	const t = useTranslations("common");
	return (
		<Pager
			page={paged.page}
			lastPage={paged.lastPage}
			total={paged.total}
			onChange={paged.goTo}
			labels={{
				showing: t("showing", { from: paged.from, to: paged.to, total: paged.total }),
				previous: t("previousPage"),
				next: t("nextPage"),
			}}
		/>
	);
}

/**
 * The table toolbar: search on the left, then one compact menu per filter. Space separates
 * the controls; only the one the cashier is using carries colour.
 */
export function FilterBar({
	search,
	children,
	end,
	onClear,
}: {
	search?: ReactNode;
	children?: ReactNode;
	end?: ReactNode;
	/** Shown as "ล้างตัวกรอง" once any filter differs from its default. */
	onClear?: () => void;
}) {
	const t = useTranslations("common");
	return (
		<div className="flex flex-col gap-2 border-border/60 border-b px-4 py-3 tablet:flex-row tablet:items-center">
			{search ? <div className="w-full tablet:w-72">{search}</div> : null}
			<div className="flex flex-wrap items-center gap-2">
				{children}
				{onClear ? (
					<button
						type="button"
						onClick={onClear}
						className="h-8 rounded-md px-2 font-medium text-muted-foreground text-sm transition-colors hover:text-foreground"
					>
						{t("clearFilters")}
					</button>
				) : null}
			</div>
			{end ? <div className="flex items-center gap-2 tablet:ml-auto">{end}</div> : null}
		</div>
	);
}

const DOT: Record<Tone | "neutral", string> = {
	success: "bg-success",
	warning: "bg-warning",
	danger: "bg-danger",
	// There is no info token; chart-4 is the sky blue the badges use for "info".
	info: "bg-chart-4",
	primary: "bg-primary",
	neutral: "bg-muted-foreground/60",
};

export interface FilterOption<T extends string> {
	value: T;
	label: string;
	/** Shown right-aligned in the menu (not on the chip), e.g. how many products are low. */
	count?: number;
	/** A status colour dot, matching the badge the table shows for that status. */
	tone?: Tone | "neutral";
}

/**
 * One filter as a single button that opens its choices.
 *
 * With `defaultValue`, the filter is optional: at its default it is a quiet dashed chip that
 * just names itself ("สถานะ"); once set it turns solid, shows the choice ("สถานะ · สำเร็จ")
 * and grows an × to drop it. Without one (a date range, a sort order) it always has a value
 * and simply shows it.
 */
export function FilterMenu<T extends string>({
	icon: Icon,
	label,
	value,
	onChange,
	options,
	defaultValue,
	showLabel = false,
}: {
	icon: LucideIcon;
	label: string;
	value: T;
	onChange: (value: T) => void;
	options: FilterOption<T>[];
	defaultValue?: T;
	/** Prefix an always-set value with its name, where the value alone is unclear ("เรียงตาม ชื่อ"). */
	showLabel?: boolean;
}) {
	const t = useTranslations("common");
	const optional = defaultValue !== undefined;
	const active = optional && value !== defaultValue;
	const current = options.find((o) => o.value === value)?.label ?? "";

	return (
		<div
			className={cn(
				"flex h-8 items-center rounded-md text-sm transition-colors",
				optional && !active
					? "border border-border border-dashed text-muted-foreground hover:border-foreground/30 hover:text-foreground"
					: active
						? "bg-primary/10 text-primary"
						: "bg-muted/70 hover:bg-muted"
			)}
		>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className={cn(
							"flex h-full items-center gap-1.5 rounded-md pl-2.5 font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
							active ? "pr-1" : "pr-2"
						)}
					>
						<Icon className="size-3.5 opacity-80" />
						{optional ? (
							<>
								{label}
								{active ? (
									<>
										<span className="h-3.5 w-px bg-current opacity-25" aria-hidden />
										<span>{current}</span>
									</>
								) : null}
							</>
						) : (
							<span>
								{showLabel ? <span className="text-muted-foreground">{label} </span> : null}
								{current}
							</span>
						)}
						{active ? null : <ChevronDown className="size-3.5 opacity-60" />}
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="min-w-52 p-1">
					<DropdownMenuLabel className="px-2 pt-1.5 pb-1 font-normal text-muted-foreground text-xs">{label}</DropdownMenuLabel>
					<DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as T)}>
						{options.map((o, index) => (
							<Fragment key={o.value}>
								{/* The "all" choice sits apart from the choices it is the sum of. */}
								{optional && index === 1 && options[0]?.value === defaultValue ? (
									<DropdownMenuSeparator className="my-1" />
								) : null}
								<DropdownMenuRadioItem value={o.value} className="h-8 gap-2.5 pl-2">
									{o.tone ? <span className={cn("size-2 shrink-0 rounded-full", DOT[o.tone])} aria-hidden /> : null}
									<span className="flex-1">{o.label}</span>
									{o.count !== undefined ? (
										<span className="numeric text-muted-foreground text-xs tabular-nums">{formatNumber(o.count)}</span>
									) : null}
								</DropdownMenuRadioItem>
							</Fragment>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>
			{active ? (
				<button
					type="button"
					onClick={() => onChange(defaultValue)}
					aria-label={t("removeFilter", { name: label })}
					className="mr-1 flex size-6 items-center justify-center rounded hover:bg-primary/15"
				>
					<X className="size-3.5" />
				</button>
			) : null}
		</div>
	);
}
