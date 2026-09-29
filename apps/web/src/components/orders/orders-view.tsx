"use client";

import { useOrderTag } from "@/components/pos/order-tag";
import { type Column, DataTable, FilterBar, FilterMenu, Pager, SearchInput } from "@/components/common/controls";
import { OrderStatusBadge, PaymentMethodLabel } from "@/components/common/order-badges";
import { EmptyState, PageContainer, PageHeader, Surface, TableSkeleton } from "@/components/common/primitives";
import { Button } from "@posly/ui/components/button";
import { Link, useRouter } from "@/i18n/navigation";
import { formatClock } from "@posly/utils/format";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { api } from "@/lib/api/posly";
import { downloadFile, orderItemLines, ordersToCsv, salesFileName } from "@/lib/export/csv";
import { Tooltip, TooltipContent, TooltipTrigger } from "@posly/ui/components/tooltip";
import { toast } from "sonner";
import { useOrders } from "@/hooks/use-posly";
import { dayRange, formatThaiDate } from "@posly/utils/format";
import { formatBaht } from "@posly/utils/money";
import type { Order, OrderStatus, PaymentMethod } from "@posly/types/domain";
import { CalendarDays, CircleDot, CreditCard, Download, Loader2, ReceiptText, ShoppingCart, UserRound, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useState } from "react";

/** The API caps a page at 100; export walks the pages at that size. */
const EXPORT_PAGE_SIZE = 100;

type StatusFilter = "all" | Extract<OrderStatus, "PAID" | "REFUNDED" | "CANCELLED">;

/** Orders (plan §14): filter by day, status and method; the row opens the detail. */
export function OrdersView() {
	const t = useTranslations("orders");
	const tagOf = useOrderTag();
	const tStatus = useTranslations("orderStatus");
	const tMethod = useTranslations("paymentMethod");
	const router = useRouter();
	const [range, setRange] = useState<"today" | "yesterday" | "7d">("today");
	const [status, setStatus] = useState<StatusFilter>("all");
	const [method, setMethod] = useState<PaymentMethod | "all">("all");
	const searchParams = useSearchParams();
	const [query, setQuery] = useState(() => searchParams.get("search") ?? "");
	// Arriving from a customer's "ดูออเดอร์": their orders, with a chip to drop the filter.
	const [customer, setCustomer] = useState(() => {
		const id = searchParams.get("customer");
		return id ? { id, name: searchParams.get("customerName") ?? "" } : null;
	});

	const search = useDeferredValue(query.trim());
	const period = dayRange(range);
	const filters = {
		// A customer's orders are their whole history, not today's.
		...(customer ? {} : period),
		status: status === "all" ? undefined : status,
		method: method === "all" ? undefined : method,
		search: search || undefined,
		customerId: customer?.id,
	};
	// The page belongs to one set of filters: changing a filter starts again from page 1,
	// without an effect resetting state after the fact.
	const filterKey = JSON.stringify(filters);
	const [paging, setPaging] = useState({ key: filterKey, page: 1 });
	const page = paging.key === filterKey ? paging.page : 1;
	const orders = useOrders({ ...filters, page });
	const rows = orders.data?.data ?? [];
	const meta = orders.data?.meta;
	const goTo = (next: number) => {
		setPaging({ key: filterKey, page: next });
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	const { business } = useWorkspace();
	const [exporting, setExporting] = useState(false);
	/**
	 * Everything the filters match, not just the page on screen: every page is fetched at the
	 * API's maximum size and written as one sheet. The API applies the same scoping as the
	 * list, so a cashier exports only their own sales.
	 */
	const exportCsv = async () => {
		setExporting(true);
		try {
			const all: Order[] = [];
			for (let next = 1, last = 1; next <= last; next++) {
				const res = await api.orders.list(business.id, { ...filters, page: next, limit: EXPORT_PAGE_SIZE });
				all.push(...res.data);
				last = res.meta.last_page;
			}
			const csv = ordersToCsv(all, {
				headers: {
					number: t("csv.number"),
					date: t("csv.date"),
					time: t("time"),
					employee: t("employee"),
					customer: t("customer"),
					method: t("method"),
					items: t("items"),
					quantity: t("csv.quantity"),
					subtotal: t("subtotal"),
					discount: t("discount"),
					vat: t("vat"),
					total: t("total"),
					status: t("status"),
				},
				method: (m) => tMethod(m),
				status: (s) => tStatus(s),
				tag: { header: t("csv.tag"), of: tagOf },
			});
			// A customer filter ignores the period, so the name must not claim one.
			downloadFile(salesFileName(period, customer?.name), csv);
			toast.success(t("exported", { count: all.length }));
		} catch (error) {
			toast.error(error instanceof Error ? error.message : t("exportFailed"));
		} finally {
			setExporting(false);
		}
	};

	const columns: Column<Order>[] = [
		{
			key: "number",
			header: t("order"),
			cell: (o) => (
				<span>
					<span className="numeric block font-medium">#{o.number}</span>
					{tagOf(o) ? <span className="block text-muted-foreground text-xs">{tagOf(o)}</span> : null}
				</span>
			),
		},
		{
			key: "time",
			header: t("time"),
			// A single day needs only the time; across days the date is what tells rows apart.
			cell: (o) => (
				<span className="numeric text-muted-foreground">
					{range === "today" ? null : (
						<span className="mr-1.5 text-foreground">
							{formatThaiDate(o.createdAt, { weekday: "short", day: "numeric", month: "short" })}
						</span>
					)}
					{formatClock(o.createdAt)}
				</span>
			),
		},
		{
			key: "items",
			header: t("items"),
			hideBelow: "tablet",
			// One line, cut with an ellipsis; the whole order on hover or keyboard focus.
			cell: (o) => {
				const lines = orderItemLines(o);
				return (
					<Tooltip>
						<TooltipTrigger asChild>
							<span tabIndex={0} className="block max-w-56 truncate outline-none desktop:max-w-72">
								{lines.map((l) => `${l.label} ×${l.quantity}`).join(", ")}
							</span>
						</TooltipTrigger>
						<TooltipContent side="bottom" align="start" className="max-w-80 py-2">
							<ul className="space-y-1">
								{lines.map((l) => (
									<li key={l.label} className="flex justify-between gap-6">
										<span>{l.label}</span>
										<span className="numeric opacity-70">×{l.quantity}</span>
									</li>
								))}
							</ul>
						</TooltipContent>
					</Tooltip>
				);
			},
		},
		{ key: "employee", header: t("employee"), cell: (o) => o.employeeName, hideBelow: "tablet" },
		{
			key: "payment",
			header: t("payment"),
			cell: (o) => <PaymentMethodLabel method={o.paymentMethod} />,
			hideBelow: "tablet",
		},
		{
			key: "total",
			header: t("total"),
			align: "right",
			cell: (o) => <span className="numeric font-semibold">{formatBaht(o.total)}</span>,
		},
		{ key: "status", header: t("status"), className: "w-36 pl-8", cell: (o) => <OrderStatusBadge status={o.status} /> },
	];

	return (
		<PageContainer>
			<PageHeader
				title={t("title")}
				description={t("description", { count: meta?.total ?? 0 })}
				actions={
					<Button
						variant="outline"
						size="lg"
						data-tour="orders-export"
						onClick={exportCsv}
						disabled={exporting || !meta || meta.total === 0}
					>
						{exporting ? <Loader2 className="animate-spin" /> : <Download />}
						{exporting ? t("exporting") : t("export")}
					</Button>
				}
			/>

			<Surface className="overflow-hidden p-0" data-tour="orders-list">
				<FilterBar
					search={
						<SearchInput tone="toolbar" value={query} onChange={setQuery} placeholder={t("search")} />
					}
					onClear={
						status !== "all" || method !== "all" || customer
							? () => {
									setStatus("all");
									setMethod("all");
									setCustomer(null);
								}
							: undefined
					}
				>
					{customer ? (
						<span className="flex h-8 items-center gap-1.5 rounded-md bg-primary/10 pr-1 pl-2.5 font-medium text-primary text-sm">
							<UserRound className="size-3.5" />
							{t("customerFilter", { name: customer.name })}
							<button
								type="button"
								onClick={() => setCustomer(null)}
								aria-label={t("clearCustomer")}
								className="flex size-6 items-center justify-center rounded hover:bg-primary/15"
							>
								<X className="size-3.5" />
							</button>
						</span>
					) : null}
					{customer ? null : (
<FilterMenu
						icon={CalendarDays}
						label={t("period")}
						value={range}
						onChange={setRange}
						options={[
							{ value: "today", label: t("today") },
							{ value: "yesterday", label: t("yesterday") },
							{ value: "7d", label: t("last7") },
						]}
					/>
)}
					<FilterMenu
						icon={CircleDot}
						label={t("status")}
						value={status}
						defaultValue="all"
						onChange={setStatus}
						options={[
							{ value: "all", label: t("allStatus") },
							{ value: "PAID", label: tStatus("PAID"), tone: "success" },
							{ value: "REFUNDED", label: tStatus("REFUNDED"), tone: "danger" },
							{ value: "CANCELLED", label: tStatus("CANCELLED"), tone: "neutral" },
						]}
					/>
					<FilterMenu
						icon={CreditCard}
						label={t("method")}
						value={method}
						defaultValue="all"
						onChange={setMethod}
						options={[
							{ value: "all", label: t("allMethods") },
							...(["CASH", "PROMPTPAY", "CARD", "OTHER"] as const).map((m) => ({ value: m, label: tMethod(m) })),
						]}
					/>
				</FilterBar>
				{orders.isPending ? (
					<TableSkeleton />
				) : rows.length === 0 ? (
					<EmptyState
						icon={ReceiptText}
						title={t("empty")}
						description={t("emptyHint")}
						action={
							<Button asChild size="lg" className="brand-gradient">
								<Link href="/pos">
									<ShoppingCart />
									{t("openPos")}
								</Link>
							</Button>
						}
					/>
				) : (
					<>
						<DataTable
							columns={columns}
							rows={rows}
							rowKey={(o) => o.id}
							onRowClick={(o) => router.push(`/orders/${o.id}`)}
							className={orders.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}
						/>
						{meta ? (
							<Pager
								page={meta.page}
								lastPage={meta.last_page}
								total={meta.total}
								disabled={orders.isFetching}
								onChange={goTo}
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
