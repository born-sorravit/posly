"use client";

import {
	type Column,
	DataTable,
	FilterBar,
	FilterMenu,
	PagedFooter,
	SearchInput,
} from "@/components/common/controls";
import { usePagedRows } from "@/hooks/use-paged-rows";
import { StockBadge } from "@/components/common/order-badges";
import { EmptyState, PageContainer, PageHeader, StatusBadge, Surface } from "@/components/common/primitives";
import { ProductRowsSkeleton } from "@/components/products/products-skeletons";
import { ProductThumb } from "@/components/common/product-thumb";
import { Button } from "@posly/ui/components/button";
import { Link, useRouter } from "@/i18n/navigation";
import { useCategories, useProducts } from "@/hooks/use-posly";
import { useActiveBusiness } from "@/hooks/use-workspace";
import { stockStatus } from "@/lib/stock";
import { formatBaht } from "@posly/utils/money";
import type { Product } from "@posly/types/domain";
import { ArrowDownUp, Package, Plus, Tags } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

type Sort = "name" | "price" | "stock";

/** Product management (plan §15): search, filter by category, sort; the row opens the editor. */
export function ProductsView() {
	const t = useTranslations("products");
	const tCommon = useTranslations("common");
	const router = useRouter();
	const [query, setQuery] = useState("");
	const [category, setCategory] = useState("all");
	const [sort, setSort] = useState<Sort>("name");

	const products = useProducts();
	const canWrite = useActiveBusiness().can("products:write");
	const categories = useCategories();
	const categoryName = (id: string | null) =>
		categories.data?.find((c) => c.id === id)?.name ?? "—";

	const rows = useMemo(() => {
		const q = query.trim().toLowerCase();
		return [...(products.data ?? [])]
			.filter(
				(p) =>
					(category === "all" || p.categoryId === category) &&
					(!q || p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q))
			)
			.sort((a, b) =>
				sort === "price"
					? b.price - a.price
					: sort === "stock"
						? (a.stock ?? Number.POSITIVE_INFINITY) - (b.stock ?? Number.POSITIVE_INFINITY)
						: a.name.localeCompare(b.name)
			);
	}, [query, category, sort, products.data]);
	const paged = usePagedRows(rows, `${query}|${category}|${sort}`);

	const columns: Column<Product>[] = [
		{
			key: "product",
			header: t("product"),
			cell: (p) => (
				<span className="flex items-center gap-3">
					<ProductThumb art={p.art} imageUrl={p.imageUrl} name={p.name} className="size-10" rounded="rounded-lg" />
					<span className="min-w-0">
						<span className="block truncate font-medium">{p.name}</span>
						<span className="block text-muted-foreground text-xs">{p.sku ?? "—"}</span>
					</span>
				</span>
			),
		},
		{ key: "category", header: t("category"), cell: (p) => categoryName(p.categoryId), hideBelow: "tablet" },
		{
			key: "price",
			header: t("price"),
			align: "right",
			cell: (p) => <span className="numeric font-medium">{formatBaht(p.price)}</span>,
		},
		{
			key: "stock",
			header: t("stock"),
			align: "right",
			hideBelow: "tablet",
			cell: (p) => (
				<span className="flex items-center justify-end gap-2">
					<span className="numeric">{p.trackStock ? `${p.stock} ${p.unit}` : "—"}</span>
					<StockBadge status={stockStatus(p)} />
				</span>
			),
		},
		{
			key: "status",
			header: t("status"),
			hideBelow: "desktop",
			cell: (p) => (
				<StatusBadge tone={p.isActive ? "success" : "neutral"} dot>
					{p.isActive ? tCommon("active") : tCommon("inactive")}
				</StatusBadge>
			),
		},
	];

	return (
		<PageContainer>
			<PageHeader
				title={t("title")}
				description={
					products.isPending ? (
						// Not "0 products" while the list is still on its way.
						<span className="inline-block h-4 w-48 animate-pulse rounded-md bg-muted align-middle" aria-hidden />
					) : (
						t("description", { count: products.data?.length ?? 0 })
					)
				}
				actions={
					canWrite ? (
						<Button asChild size="lg" className="brand-gradient" data-tour="products-add">
							<Link href="/products/new">
								<Plus />
								{t("add")}
							</Link>
						</Button>
					) : null
				}
			/>

			<Surface className="overflow-hidden p-0" data-tour="products-list">
				<FilterBar
					search={
						<SearchInput tone="toolbar" value={query} onChange={setQuery} placeholder={t("search")} />
					}
					onClear={category !== "all" ? () => setCategory("all") : undefined}
					end={
						<FilterMenu
							icon={ArrowDownUp}
							label={t("sortBy")}
							showLabel
							value={sort}
							onChange={setSort}
							options={[
								{ value: "name", label: t("sortName") },
								{ value: "price", label: t("sortPrice") },
								{ value: "stock", label: t("sortStock") },
							]}
						/>
					}
				>
					<FilterMenu
						icon={Tags}
						label={t("category")}
						value={category}
						defaultValue="all"
						onChange={setCategory}
						options={[
							{ value: "all", label: t("allCategories") },
							...(categories.data ?? []).map((c) => ({ value: c.id, label: c.name })),
						]}
					/>
				</FilterBar>
				{products.isPending ? (
					<ProductRowsSkeleton />
				) : rows.length === 0 ? (
					<EmptyState
						icon={Package}
						title={t("empty")}
						description={t("emptyHint")}
						action={
							canWrite ? (
							<Button asChild size="lg" className="brand-gradient">
								<Link href="/products/new">
									<Plus />
									{t("add")}
								</Link>
							</Button>
							) : undefined
						}
					/>
				) : (
<>
					<DataTable
						columns={columns}
						rows={paged.pageRows}
						rowKey={(p) => p.id}
						onRowClick={(p) => router.push(`/products/${p.id}`)}
					/>
					<PagedFooter paged={paged} />
					</>
				)}
			</Surface>
		</PageContainer>
	);
}
