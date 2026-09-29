"use client";

import { type Column, DataTable, FilterBar, FilterMenu, PagedFooter, SearchInput } from "@/components/common/controls";
import { usePagedRows } from "@/hooks/use-paged-rows";
import { StockBadge } from "@/components/common/order-badges";
import {
	EmptyState,
	MetricCard,
	PageContainer,
	PageHeader,
	Surface,
} from "@/components/common/primitives";
import { ProductThumb } from "@/components/common/product-thumb";
import { Button } from "@posly/ui/components/button";
import { StockAdjustDialog } from "@/components/catalog/stock-adjust-dialog";
import { useActiveBusiness, useFeature } from "@/hooks/use-workspace";
import { Link } from "@/i18n/navigation";
import { useProducts } from "@/hooks/use-posly";
import { stockStatus } from "@/lib/stock";
import type { Product } from "@posly/types/domain";
import { Boxes, CircleDot, History, Lock, PackageCheck, PackageX, Plus, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useDeferredValue, useMemo, useState } from "react";

/**
 * Inventory overview (plan §18, phase 2). Gated on the INVENTORY entitlement: without it the
 * page explains the upgrade instead of showing a broken table.
 */
export function InventoryView() {
	const t = useTranslations("inventory");
	const enabled = useFeature("INVENTORY");
	const [filter, setFilter] = useState<"all" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK">("all");
	const [query, setQuery] = useState("");
	const canAdjust = useActiveBusiness().can("inventory:write");
	// `productId: null` is "รับสินค้าเข้า" from the header, which picks the product in the dialog.
	const [adjusting, setAdjusting] = useState<{ productId: string | null } | null>(null);
	const search = useDeferredValue(query.trim().toLowerCase());

	const products = useProducts();
	const tracked = useMemo(() => (products.data ?? []).filter((p) => p.trackStock), [products.data]);
	const counts = {
		in: tracked.filter((p) => stockStatus(p) === "IN_STOCK").length,
		low: tracked.filter((p) => stockStatus(p) === "LOW_STOCK").length,
		out: tracked.filter((p) => stockStatus(p) === "OUT_OF_STOCK").length,
	};
	const rows = tracked.filter(
		(p) =>
			(filter === "all" || stockStatus(p) === filter) &&
			(!search || p.name.toLowerCase().includes(search) || p.sku?.toLowerCase().includes(search))
	);
	const paged = usePagedRows(rows, `${filter}|${search}`);

	if (!enabled) {
		return (
			<PageContainer>
				<EmptyState
					icon={Lock}
					title={t("lockedTitle")}
					description={t("lockedHint")}
					action={
						<Button asChild size="lg" className="brand-gradient">
							<Link href="/settings/subscription">{t("upgrade")}</Link>
						</Button>
					}
				/>
			</PageContainer>
		);
	}

	const columns: Column<Product>[] = [
		{
			key: "product",
			header: t("product"),
			cell: (p) => (
				<span className="flex items-center gap-3">
					<ProductThumb art={p.art} name={p.name} className="size-10" rounded="rounded-lg" />
					<span className="font-medium">{p.name}</span>
				</span>
			),
		},
		{
			key: "current",
			header: t("current"),
			align: "right",
			cell: (p) => <span className="numeric font-medium">{p.stock} {p.unit}</span>,
		},
		{
			key: "minimum",
			header: t("minimum"),
			align: "right",
			hideBelow: "tablet",
			cell: (p) => <span className="numeric text-muted-foreground">{p.lowStockAt ?? "—"}</span>,
		},
		{ key: "status", header: t("status"), cell: (p) => <StockBadge status={stockStatus(p)} /> },
		{
			key: "actions",
			header: "",
			align: "right",
			hideBelow: "tablet",
			cell: (p) =>
				canAdjust ? (
					<span className="inline-flex items-center gap-1">
						<Button asChild variant="ghost" size="icon-sm" aria-label={t("viewHistory")} title={t("viewHistory")}>
							<Link href={`/inventory/history?product=${p.id}`}>
								<History />
							</Link>
						</Button>
						<Button variant="outline" size="sm" onClick={() => setAdjusting({ productId: p.id })}>
							{t("adjust")}
						</Button>
					</span>
				) : null,
		},
	];

	return (
		<PageContainer>
			<PageHeader
				title={t("title")}
				description={t("description")}
				actions={
					canAdjust ? (
						<>
						<Button asChild variant="outline" size="lg" data-tour="inventory-history">
							<Link href="/inventory/history">
								<History />
								{t("history")}
							</Link>
						</Button>
						<Button
							size="lg"
							className="brand-gradient"
							data-tour="inventory-adjust"
							disabled={tracked.length === 0}
							onClick={() => setAdjusting({ productId: null })}
						>
							<Plus />
							{t("stockIn")}
						</Button>
						</>
					) : undefined
				}
			/>
			<div className="grid grid-cols-3 gap-3" data-tour="inventory-status">
				<MetricCard icon={PackageCheck} tone="success" label={t("inStock")} value={counts.in} />
				<MetricCard icon={TriangleAlert} tone="warning" label={t("lowStock")} value={counts.low} />
				<MetricCard icon={PackageX} tone="danger" label={t("outOfStock")} value={counts.out} />
			</div>
			<Surface className="overflow-hidden p-0">
				<FilterBar
					search={<SearchInput tone="toolbar" value={query} onChange={setQuery} placeholder={t("search")} />}
					onClear={filter !== "all" ? () => setFilter("all") : undefined}
				>
					<FilterMenu
						icon={CircleDot}
						label={t("status")}
						value={filter}
						defaultValue="all"
						onChange={setFilter}
						options={[
							{ value: "all", label: t("all"), count: tracked.length },
							{ value: "IN_STOCK", label: t("inStock"), count: counts.in, tone: "success" },
							{ value: "LOW_STOCK", label: t("lowStock"), count: counts.low, tone: "warning" },
							{ value: "OUT_OF_STOCK", label: t("outOfStock"), count: counts.out, tone: "danger" },
						]}
					/>
				</FilterBar>
				{rows.length === 0 ? (
					<EmptyState icon={Boxes} title={t("emptyFilter")} />
				) : (
					<>
						<DataTable columns={columns} rows={paged.pageRows} rowKey={(p) => p.id} />
						<PagedFooter paged={paged} />
					</>
				)}
			</Surface>
			<StockAdjustDialog
				open={adjusting !== null}
				onOpenChange={(open) => !open && setAdjusting(null)}
				products={tracked}
				productId={adjusting?.productId ?? null}
			/>
		</PageContainer>
	);
}
