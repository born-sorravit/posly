"use client";

import { type Column, DataTable, FilterBar, FilterMenu, Pager } from "@/components/common/controls";
import { EmptyState, PageContainer, StatusBadge, Surface, TableSkeleton } from "@/components/common/primitives";
import { ProductThumb } from "@/components/common/product-thumb";
import { Button } from "@posly/ui/components/button";
import { useProducts, useStockAdjustments } from "@/hooks/use-posly";
import { Link } from "@/i18n/navigation";
import type { StockAdjustmentDto, StockAdjustmentType } from "@/lib/api/posly";
import { formatClock, formatNumber, formatThaiDate } from "@posly/utils/format";
import { formatBaht } from "@posly/utils/money";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, History, Package, Shapes } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

const TYPE_TONE = { IN: "success", OUT: "warning", COUNT: "neutral" } as const;

/** "+12", "−3", "0" — a real minus sign, so the column lines up. */
const signed = (n: number) => (n > 0 ? `+${formatNumber(n)}` : n < 0 ? `−${formatNumber(-n)}` : "0");

/**
 * Every stock adjustment, newest first (plan §18). Filterable by product and type; a row's
 * "ดูประวัติ" on the stock page lands here with that product already chosen.
 */
export function StockHistoryView() {
	const t = useTranslations("inventory");
	const searchParams = useSearchParams();
	const [productId, setProductId] = useState(() => searchParams.get("product") ?? "all");
	const [type, setType] = useState<StockAdjustmentType | "all">("all");

	const products = useProducts();
	const tracked = (products.data ?? []).filter((p) => p.trackStock);

	const filters = {
		productId: productId === "all" ? undefined : productId,
		type: type === "all" ? undefined : type,
	};
	const filterKey = JSON.stringify(filters);
	const [paging, setPaging] = useState({ key: filterKey, page: 1 });
	const page = paging.key === filterKey ? paging.page : 1;
	const history = useStockAdjustments({ ...filters, page });
	const rows = history.data?.data ?? [];
	const meta = history.data?.meta;
	const filtered = productId !== "all" || type !== "all";

	const typeLabel = (of: StockAdjustmentType) =>
		of === "IN" ? t("typeIn") : of === "OUT" ? t("typeOut") : t("typeCount");

	const columns: Column<StockAdjustmentDto>[] = [
		{
			key: "when",
			header: t("when"),
			cell: (r) => (
				<span className="numeric whitespace-nowrap">
					{formatThaiDate(r.createdAt, { day: "numeric", month: "short" })}
					<span className="ml-1.5 text-muted-foreground">{formatClock(r.createdAt)}</span>
				</span>
			),
		},
		{
			key: "product",
			header: t("product"),
			cell: (r) => (
				<span className="flex items-center gap-3">
					<ProductThumb art={r.art} name={r.productName} className="size-9" rounded="rounded-lg" />
					<span className="min-w-0">
						<span className={cn("block font-medium", r.productDeleted && "text-muted-foreground")}>{r.productName}</span>
						{/* A receipt at a price: what was paid, and where it moved the cost. */}
						{r.unitCost !== null ? (
							<span className="numeric block text-muted-foreground text-xs">
								{t("paidPerUnit", { price: formatBaht(r.unitCost), unit: r.productUnit })}
								{r.costAfter !== null && r.costAfter !== r.costBefore
									? ` · ${t("costMoved", { before: r.costBefore !== null ? formatBaht(r.costBefore) : "—", after: formatBaht(r.costAfter) })}`
									: ""}
							</span>
						) : null}
					</span>
					{r.productDeleted ? <StatusBadge tone="neutral">{t("deleted")}</StatusBadge> : null}
				</span>
			),
		},
		{
			key: "type",
			header: t("type"),
			cell: (r) => <StatusBadge tone={TYPE_TONE[r.type]}>{typeLabel(r.type)}</StatusBadge>,
		},
		{
			key: "change",
			header: t("change"),
			align: "right",
			cell: (r) => (
				<span className="flex flex-col items-end leading-tight">
					<span
						className={cn(
							"numeric font-semibold",
							r.change > 0 ? "text-success" : r.change < 0 ? "text-warning" : "text-muted-foreground"
						)}
					>
						{signed(r.change)}
					</span>
					{/* A count is entered as a total; show what was typed as well as the difference. */}
					{r.type === "COUNT" ? (
						<span className="numeric text-muted-foreground text-xs">{t("countedTo", { count: formatNumber(r.quantity) })}</span>
					) : null}
				</span>
			),
		},
		{
			key: "balance",
			header: t("balance"),
			align: "right",
			hideBelow: "tablet",
			cell: (r) => (
				<span className="numeric inline-flex items-center gap-1.5 whitespace-nowrap">
					<span className="text-muted-foreground">{formatNumber(r.before)}</span>
					<ArrowRight className="size-3 text-muted-foreground" />
					<span className="font-medium">{formatNumber(r.after)}</span>
					<span className="text-muted-foreground text-xs">{r.productUnit}</span>
				</span>
			),
		},
		{ key: "by", header: t("by"), className: "pl-8", hideBelow: "tablet", cell: (r) => r.actorName },
		{
			key: "note",
			header: t("note"),
			hideBelow: "desktop",
			cell: (r) =>
				r.note ? (
					<span className="line-clamp-1 max-w-56 text-muted-foreground">{r.note}</span>
				) : (
					<span className="text-muted-foreground">—</span>
				),
		},
	];

	return (
		<PageContainer>
			<div className="flex items-center gap-3">
				<Button asChild variant="ghost" size="icon-lg" aria-label={t("backToStock")}>
					<Link href="/inventory">
						<ArrowLeft />
					</Link>
				</Button>
				<div>
					<h1 className="font-semibold text-2xl tracking-tight">{t("historyTitle")}</h1>
					<p className="text-muted-foreground text-sm">{t("historyDescription")}</p>
				</div>
			</div>

			<Surface className="overflow-hidden p-0">
				<FilterBar
					onClear={
						filtered
							? () => {
									setProductId("all");
									setType("all");
								}
							: undefined
					}
				>
					<FilterMenu
						icon={Package}
						label={t("product")}
						value={productId}
						defaultValue="all"
						onChange={setProductId}
						options={[
							{ value: "all", label: t("allProducts") },
							...tracked.map((p) => ({ value: p.id, label: p.name })),
							// A product linked from elsewhere may no longer track stock; keep it choosable.
							...(productId !== "all" && !tracked.some((p) => p.id === productId)
								? [{ value: productId, label: rows[0]?.productName ?? "…" }]
								: []),
						]}
					/>
					<FilterMenu
						icon={Shapes}
						label={t("type")}
						value={type}
						defaultValue="all"
						onChange={setType}
						options={[
							{ value: "all", label: t("allTypes") },
							{ value: "IN", label: t("typeIn") },
							{ value: "OUT", label: t("typeOut") },
							{ value: "COUNT", label: t("typeCount") },
						]}
					/>
				</FilterBar>

				{history.isPending ? (
					<TableSkeleton />
				) : rows.length === 0 ? (
					<EmptyState
						icon={History}
						title={filtered ? t("historyEmptyFilter") : t("historyEmpty")}
						description={filtered ? undefined : t("historyEmptyHint")}
					/>
				) : (
					<>
						<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
						{meta ? (
							<Pager
								page={meta.page}
								lastPage={meta.last_page}
								total={meta.total}
								disabled={history.isFetching}
								onChange={(next) => {
									setPaging({ key: filterKey, page: next });
									window.scrollTo({ top: 0, behavior: "smooth" });
								}}
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
		</PageContainer>
	);
}
