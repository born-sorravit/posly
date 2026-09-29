"use client";

import { type Column, ConfirmDialog, DataTable, FilterBar, FilterMenu, Pager } from "@/components/common/controls";
import { FeatureLocked } from "@/components/common/feature-locked";
import { EmptyState, PageContainer, PageHeader, Surface, TableSkeleton } from "@/components/common/primitives";
import { Button } from "@posly/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@posly/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@posly/ui/components/dropdown-menu";
import { Input } from "@posly/ui/components/input";
import { Label } from "@posly/ui/components/label";
import { useExpenseMutations, useExpenses, useExpenseSummary } from "@/hooks/use-posly";
import { useFeature } from "@/hooks/use-workspace";
import type { ExpenseCategory, ExpenseDto, ExpenseFilters } from "@/lib/api/posly";
import { formatThaiDate } from "@posly/utils/format";
import { formatBaht, fromBaht } from "@posly/utils/money";
import { cn } from "@/lib/utils";
import {
	CalendarDays,
	Ellipsis,
	HandCoins,
	House,
	type LucideIcon,
	MoreHorizontal,
	Pencil,
	Plus,
	Shapes,
	ShoppingBasket,
	Trash2,
	Wallet,
	Wrench,
	Zap,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; icon: LucideIcon; ink: string; dot: string }[] = [
	{ value: "INGREDIENTS", icon: ShoppingBasket, ink: "text-[#16a34a] bg-[#16a34a]/12", dot: "bg-[#16a34a]" },
	{ value: "UTILITIES", icon: Zap, ink: "text-[#d97706] bg-[#d97706]/12", dot: "bg-[#d97706]" },
	{ value: "SALARY", icon: HandCoins, ink: "text-[#635bff] bg-[#635bff]/12", dot: "bg-[#635bff]" },
	{ value: "RENT", icon: House, ink: "text-[#0891b2] bg-[#0891b2]/12", dot: "bg-[#0891b2]" },
	{ value: "EQUIPMENT", icon: Wrench, ink: "text-[#db2777] bg-[#db2777]/12", dot: "bg-[#db2777]" },
	{ value: "OTHER", icon: Ellipsis, ink: "text-muted-foreground bg-muted", dot: "bg-muted-foreground/50" },
];
const CATEGORY = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.value, c])) as Record<
	ExpenseCategory,
	(typeof EXPENSE_CATEGORIES)[number]
>;

type Period = "thisMonth" | "lastMonth" | "last3" | "all";

/** Shop-local YYYY-MM-DD. */
const localDate = (date: Date) =>
	new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

/** Inclusive day range for a period, in Bangkok calendar months. */
const periodRange = (period: Period): { from?: string; to?: string } => {
	if (period === "all") return {};
	const [y, m] = localDate(new Date()).split("-").map(Number);
	const first = (year: number, month: number) => new Date(Date.UTC(year, month - 1, 1));
	const iso = (d: Date) => d.toISOString().slice(0, 10);
	const lastOf = (year: number, month: number) => new Date(Date.UTC(year, month, 0));
	if (period === "thisMonth") return { from: iso(first(y, m)), to: iso(lastOf(y, m)) };
	if (period === "lastMonth") {
		const d = first(y, m - 1);
		return { from: iso(d), to: iso(lastOf(d.getUTCFullYear(), d.getUTCMonth() + 1)) };
	}
	return { from: iso(first(y, m - 2)), to: iso(lastOf(y, m)) };
};

function CategoryIcon({ category, className }: { category: ExpenseCategory; className?: string }) {
	const { icon: Icon, ink } = CATEGORY[category];
	return (
		<span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", ink, className)}>
			<Icon className="size-4" />
		</span>
	);
}

/** Add or edit one expense. */
function ExpenseDialog({
	open,
	onOpenChange,
	editing,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	editing: ExpenseDto | null;
}) {
	const t = useTranslations("expenses");
	const { create, update } = useExpenseMutations();
	const [category, setCategory] = useState<ExpenseCategory>(editing?.category ?? "INGREDIENTS");
	const [amount, setAmount] = useState(editing ? String(editing.amount / 100) : "");
	const [spentOn, setSpentOn] = useState(editing?.spentOn ?? localDate(new Date()));
	const [note, setNote] = useState(editing?.note ?? "");
	const value = Number.parseFloat(amount);
	const valid = Number.isFinite(value) && value > 0 && Boolean(spentOn);
	const pending = create.isPending || update.isPending;

	const save = () => {
		const input = { category, amount: fromBaht(value), spentOn, note: note.trim() || undefined };
		const done = {
			onSuccess: () => {
				toast.success(t("saved"));
				onOpenChange(false);
			},
			onError: (e: Error) => toast.error(e.message),
		};
		if (editing) update.mutate({ expenseId: editing.id, ...input }, done);
		else create.mutate(input, done);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="gap-6 p-6 sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{editing ? t("edit") : t("add")}</DialogTitle>
					<DialogDescription className="sr-only">{t("description")}</DialogDescription>
				</DialogHeader>
				<form
					className="space-y-5"
					onSubmit={(e) => {
						e.preventDefault();
						if (valid && !pending) save();
					}}
				>
					<div className="space-y-2.5">
						<Label>{t("category")}</Label>
						<div role="radiogroup" className="grid grid-cols-3 gap-2">
							{EXPENSE_CATEGORIES.map((c) => (
								<button
									key={c.value}
									type="button"
									role="radio"
									aria-checked={category === c.value}
									onClick={() => setCategory(c.value)}
									className={cn(
										"flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition-[background-color,box-shadow]",
										category === c.value
											? "bg-primary/8 font-medium shadow-[inset_0_0_0_1.5px_var(--primary)]"
											: "surface hover:bg-muted/60"
									)}
								>
									<CategoryIcon category={c.value} className="size-7" />
									{t(`categories.${c.value}`)}
								</button>
							))}
						</div>
					</div>
					<div className="grid gap-4 tablet:grid-cols-2">
						<div className="space-y-2.5">
							<Label htmlFor="ex-amount">{t("amountBaht")}</Label>
							<Input
								maxLength={12}
								id="ex-amount"
								inputMode="decimal"
								// biome-ignore lint/a11y/noAutofocus: the dialog opens for this field
								autoFocus
								value={amount}
								onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
								placeholder="0.00"
								className="numeric h-11 rounded-xl text-right font-semibold"
							/>
						</div>
						<div className="space-y-2.5">
							<Label htmlFor="ex-date">{t("date")}</Label>
							<Input
								id="ex-date"
								type="date"
								value={spentOn}
								max={localDate(new Date())}
								onChange={(e) => setSpentOn(e.target.value)}
								className="h-11 rounded-xl"
							/>
						</div>
					</div>
					<div className="space-y-2.5">
						<Label htmlFor="ex-note">{t("note")}</Label>
						<Input
							id="ex-note"
							value={note}
							maxLength={200}
							onChange={(e) => setNote(e.target.value)}
							placeholder={t("notePlaceholder")}
							className="h-11 rounded-xl"
						/>
					</div>
					<DialogFooter className="-mx-6 -mb-6 mt-2 px-6 py-4">
						<Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
							{t("cancel")}
						</Button>
						<Button type="submit" size="lg" className="brand-gradient" disabled={!valid || pending}>
							{t("save")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

/**
 * Expenses (plan §19): what left the till outside a sale, by month and category. Reports
 * subtract them from gross profit; this is not accounting.
 */
export function ExpensesView() {
	const t = useTranslations("expenses");
	const enabled = useFeature("EXPENSES");
	const [period, setPeriod] = useState<Period>("thisMonth");
	const [category, setCategory] = useState<ExpenseCategory | "all">("all");
	const [dialog, setDialog] = useState<{ editing: ExpenseDto | null } | null>(null);
	const [deleting, setDeleting] = useState<ExpenseDto | null>(null);
	const { remove } = useExpenseMutations();

	const filters: Omit<ExpenseFilters, "page"> = {
		...periodRange(period),
		category: category === "all" ? undefined : category,
	};
	const filterKey = JSON.stringify(filters);
	const [paging, setPaging] = useState({ key: filterKey, page: 1 });
	const page = paging.key === filterKey ? paging.page : 1;
	const expenses = useExpenses({ ...filters, page });
	const summary = useExpenseSummary(filters);

	if (!enabled) return <FeatureLocked title={t("lockedTitle")} hint={t("lockedHint")} action={t("upgrade")} />;

	const rows = expenses.data?.data ?? [];
	const meta = expenses.data?.meta;
	const total = summary.data?.total ?? 0;
	const split = EXPENSE_CATEGORIES.map((c) => ({ ...c, amount: summary.data?.byCategory[c.value] ?? 0 })).filter(
		(c) => c.amount > 0
	);

	const columns: Column<ExpenseDto>[] = [
		{
			key: "date",
			header: t("date"),
			cell: (e) => (
				<span className="numeric whitespace-nowrap">
					{formatThaiDate(`${e.spentOn}T12:00:00+07:00`, { day: "numeric", month: "short", year: "2-digit" })}
				</span>
			),
		},
		{
			key: "category",
			header: t("category"),
			cell: (e) => (
				<span className="flex items-center gap-2.5">
					<CategoryIcon category={e.category} />
					{t(`categories.${e.category}`)}
				</span>
			),
		},
		{
			key: "note",
			header: t("note"),
			hideBelow: "tablet",
			cell: (e) => <span className="line-clamp-1 max-w-72 text-muted-foreground">{e.note ?? "—"}</span>,
		},
		{ key: "by", header: t("recordedBy"), hideBelow: "desktop", cell: (e) => e.recordedBy },
		{
			key: "amount",
			header: t("amount"),
			align: "right",
			cell: (e) => <span className="numeric font-semibold">{formatBaht(e.amount)}</span>,
		},
		{
			key: "actions",
			header: "",
			align: "right",
			className: "w-12",
			cell: (e) => (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon-sm" aria-label={t("actions")}>
							<MoreHorizontal />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={() => setDialog({ editing: e })}>
							<Pencil />
							{t("edit")}
						</DropdownMenuItem>
						<DropdownMenuItem variant="destructive" onClick={() => setDeleting(e)}>
							<Trash2 />
							{t("delete")}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			),
		},
	];

	return (
		<PageContainer>
			<PageHeader
				title={t("title")}
				description={t("description")}
				actions={
					<Button
						size="lg"
						className="brand-gradient"
						data-tour="expenses-add"
						onClick={() => setDialog({ editing: null })}
					>
						<Plus />
						{t("add")}
					</Button>
				}
			/>

			{/* The period's total and where it went, before the line items. */}
			<Surface className="space-y-4" data-tour="expenses-summary">
				<div className="flex items-end justify-between gap-4">
					<div>
						<p className="text-muted-foreground text-sm">{t("total")}</p>
						<p className="numeric font-bold text-3xl tracking-tight">{formatBaht(total)}</p>
					</div>
					<Wallet className="size-8 text-muted-foreground/40" />
				</div>
				{split.length ? (
					<>
						<div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
							{split.map((c) => (
								<span
									key={c.value}
									className={cn("h-full", c.dot)}
									style={{ width: `${(c.amount / total) * 100}%` }}
								/>
							))}
						</div>
						<ul className="grid gap-x-6 gap-y-2 tablet:grid-cols-3">
							{split.map((c) => (
								<li key={c.value} className="flex items-center gap-2 text-sm">
									<span className={cn("size-2 rounded-full", c.dot)} />
									<span className="flex-1 text-muted-foreground">{t(`categories.${c.value}`)}</span>
									<span className="numeric font-medium">{formatBaht(c.amount)}</span>
								</li>
							))}
						</ul>
					</>
				) : null}
			</Surface>

			<Surface className="overflow-hidden p-0" data-tour="expenses-list">
				<FilterBar onClear={category !== "all" ? () => setCategory("all") : undefined}>
					<FilterMenu
						icon={CalendarDays}
						label={t("period")}
						value={period}
						onChange={setPeriod}
						options={[
							{ value: "thisMonth", label: t("thisMonth") },
							{ value: "lastMonth", label: t("lastMonth") },
							{ value: "last3", label: t("last3") },
							{ value: "all", label: t("all") },
						]}
					/>
					<FilterMenu
						icon={Shapes}
						label={t("category")}
						value={category}
						defaultValue="all"
						onChange={setCategory}
						options={[
							{ value: "all", label: t("allCategories") },
							...EXPENSE_CATEGORIES.map((c) => ({ value: c.value, label: t(`categories.${c.value}`) })),
						]}
					/>
				</FilterBar>
				{expenses.isPending ? (
					<TableSkeleton />
				) : rows.length === 0 ? (
					<EmptyState icon={Wallet} title={t("empty")} description={t("emptyHint")} />
				) : (
					<>
						<DataTable columns={columns} rows={rows} rowKey={(e) => e.id} />
						{meta ? (
							<Pager
								page={meta.page}
								lastPage={meta.last_page}
								total={meta.total}
								disabled={expenses.isFetching}
								onChange={(next) => setPaging({ key: filterKey, page: next })}
								labels={{
									showing: t("showing", {
										from: (meta.page - 1) * meta.limit + 1,
										to: Math.min(meta.page * meta.limit, meta.total),
										total: meta.total,
									}),
									previous: t("previousPage"),
									next: t("nextPage"),
								}}
							/>
						) : null}
					</>
				)}
			</Surface>

			{dialog ? (
				<ExpenseDialog
					key={dialog.editing?.id ?? "new"}
					open
					onOpenChange={(open) => !open && setDialog(null)}
					editing={dialog.editing}
				/>
			) : null}
			<ConfirmDialog
				open={deleting !== null}
				onOpenChange={(open) => !open && setDeleting(null)}
				destructive
				icon={Trash2}
				title={t("deleteTitle")}
				description={
					deleting
						? t("deleteHint", { amount: formatBaht(deleting.amount), category: t(`categories.${deleting.category}`) })
						: undefined
				}
				confirmLabel={t("delete")}
				cancelLabel={t("keep")}
				onConfirm={() =>
					deleting &&
					remove.mutate(deleting.id, {
						onSuccess: () => toast.success(t("deleted")),
						onError: (e) => toast.error(e.message),
					})
				}
			/>
		</PageContainer>
	);
}
