"use client";

import { type Column, DataTable, Segmented } from "@/components/common/controls";
import { ChartSkeleton, EmptyState, MetricCard, PageContainer, PageHeader, SectionTitle, Surface } from "@/components/common/primitives";
import { ProductThumb } from "@/components/common/product-thumb";
import { PaymentBreakdown } from "@/components/dashboard/dashboard-panels";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { PeriodTable } from "@/components/reports/period-table";
import { Button } from "@posly/ui/components/button";
import { formatNumber } from "@posly/utils/format";
import { useDashboard } from "@/hooks/use-posly";
import type { DashboardDto, ReportRange } from "@/lib/api/posly";
import { formatBaht } from "@posly/utils/money";
import { downloadFile, toCsv } from "@/lib/export/csv";
import { BarChart3, Coins, Download, PiggyBank, ReceiptText, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useFeature } from "@/hooks/use-workspace";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type Tab = "sales" | "products" | "payments" | "employees";

/**
 * Where the profit figure comes from, one line per step, so a negative number explains
 * itself: sales − cost of goods = gross profit − expenses = profit after expenses.
 * Without the Expenses feature there is nothing to subtract, and it says so.
 */
function ProfitBreakdown({ metrics }: { metrics: DashboardDto["metrics"] }) {
	const t = useTranslations("reports.breakdown");
	const hasExpenses = useFeature("EXPENSES");
	const row = (label: string, value: number, tone: "plain" | "minus" | "total" = "plain") => (
		<div
			className={cn(
				"flex items-baseline justify-between gap-4 py-2.5",
				tone === "total" && "border-border border-t font-semibold"
			)}
		>
			<span className={cn(tone === "minus" && "text-muted-foreground")}>{label}</span>
			<span className={cn("numeric", tone === "minus" && "text-muted-foreground", value < 0 && tone === "total" && "text-danger")}>
				{tone === "minus" && value > 0 ? `−${formatBaht(value)}` : formatBaht(value)}
			</span>
		</div>
	);
	return (
		<Surface className="space-y-3">
			<SectionTitle className="mb-0">{t("title")}</SectionTitle>
			<div className="max-w-xl text-sm">
				{row(t("revenue"), metrics.revenue)}
				{row(t("cost"), metrics.cost, "minus")}
				{row(t("gross"), metrics.grossProfit, "total")}
				{hasExpenses ? (
					<>
						{row(t("expenses"), metrics.expenses, "minus")}
						{row(t("net"), metrics.estimatedProfit, "total")}
					</>
				) : null}
			</div>
			<p className="max-w-xl text-muted-foreground text-xs leading-relaxed">
				{hasExpenses ? t("hint") : t("hintNoExpenses")}{" "}
				{hasExpenses ? (
					<Link href="/expenses" className="font-medium text-primary hover:underline">
						{t("manage")}
					</Link>
				) : null}
			</p>
		</Surface>
	);
}

/**
 * Revenue by product as bars against the best seller. Plain HTML bars rather than a chart
 * library: five labelled rows need no axis, and the value is printed on every row.
 */
function RevenueBars({ rows }: { rows: DashboardDto["topProducts"] }) {
	const t = useTranslations("reports");
	const max = Math.max(1, ...rows.map((p) => p.revenue));
	return (
		<Surface>
			<SectionTitle>{t("revenueByProduct")}</SectionTitle>
			<ul className="grid gap-3">
				{rows.map((p) => (
					<li key={p.name} className="grid grid-cols-[8rem_1fr_5rem] items-center gap-3 text-sm">
						<span className="flex items-center gap-2 truncate">
							<ProductThumb art={p.art} name={p.name} className="size-7" rounded="rounded-md" />
							<span className="truncate">{p.name}</span>
						</span>
						<span className="h-2.5 overflow-hidden rounded-full bg-muted">
							<span
								className="block h-full rounded-full bg-chart-1"
								style={{ width: `${(p.revenue / max) * 100}%` }}
							/>
						</span>
						<span className="numeric text-right font-medium">{formatBaht(p.revenue)}</span>
					</li>
				))}
			</ul>
		</Surface>
	);
}

function ProductList({ title, rows }: { title: string; rows: DashboardDto["topProducts"] }) {
	const t = useTranslations("reports");
	return (
		<Surface>
			<SectionTitle>{title}</SectionTitle>
			<ul className="divide-y">
				{rows.map((p) => (
					<li key={p.name} className="flex items-center gap-3 py-2.5 text-sm">
						<ProductThumb art={p.art} name={p.name} className="size-9" rounded="rounded-lg" />
						<span className="flex-1 font-medium">{p.name}</span>
						<span className="numeric text-muted-foreground">{t("sold", { count: p.sold })}</span>
						<span className="numeric w-20 text-right font-medium">{formatBaht(p.revenue)}</span>
					</li>
				))}
			</ul>
		</Surface>
	);
}

/** Reports (plan §20): sales, product, payment and employee views over one date range. */
export function ReportsView() {
	const t = useTranslations("reports");
	const [tab, setTab] = useState<Tab>("sales");
	const [range, setRange] = useState<ReportRange>("7d");
	const { data } = useDashboard(range);
	const tBreakdown = useTranslations("reports.breakdown");
	const tMethod = useTranslations("paymentMethod");

	/**
	 * The report as a spreadsheet: the summary, then each table on screen, one block after
	 * another. Amounts are plain baht numbers so the columns can be summed.
	 */
	const exportCsv = () => {
		if (!data) return;
		const m = data.metrics;
		const baht = (satang: number) => satang / 100;
		const rows: (string | number | null)[][] = [
			[t("title"), t(range === "today" ? "today" : range === "7d" ? "last7" : "last30")],
			[],
			[t("revenue"), baht(m.revenue)],
			[t("orders"), m.orders],
			[t("average"), baht(m.averageOrder)],
			[tBreakdown("cost"), baht(m.cost)],
			[tBreakdown("gross"), baht(m.grossProfit)],
			[tBreakdown("expenses"), baht(m.expenses)],
			[tBreakdown("net"), baht(m.estimatedProfit)],
			[],
			[range === "today" ? t("time") : t("date"), t("orders"), t("revenue")],
			...data.series.map((b) => [range === "today" ? b.label : b.date, b.orders, baht(b.revenue)]),
			[],
			[t("topSelling"), t("csvSold"), t("revenue")],
			...data.topProducts.map((p) => [p.name, p.sold, baht(p.revenue)]),
			[],
			[t("tabs.payments"), t("orders"), t("revenue")],
			...data.paymentBreakdown.map((p) => [tMethod(p.method), p.count, baht(p.amount)]),
			[],
			[t("employee"), t("orders"), t("revenue"), t("refunds"), t("discounts")],
			...data.employees.map((e) => [e.name, e.orders, baht(e.revenue), baht(e.refunds), baht(e.discounts)]),
		];
		const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
		downloadFile(`posly-report-${range}-${day}.csv`, toCsv(rows));
	};

	type Perf = DashboardDto["employees"][number];
	const perfColumns: Column<Perf>[] = [
		{ key: "name", header: t("employee"), cell: (e) => <span className="font-medium">{e.name}</span> },
		{ key: "orders", header: t("orders"), align: "right", cell: (e) => <span className="numeric">{e.orders}</span> },
		{ key: "revenue", header: t("revenue"), align: "right", cell: (e) => <span className="numeric font-medium">{formatBaht(e.revenue)}</span> },
		{ key: "refunds", header: t("refunds"), align: "right", hideBelow: "tablet", cell: (e) => <span className="numeric">{formatBaht(e.refunds)}</span> },
		{ key: "discounts", header: t("discounts"), align: "right", hideBelow: "tablet", cell: (e) => <span className="numeric">{formatBaht(e.discounts)}</span> },
	];

	return (
		<PageContainer>
			<PageHeader
				title={t("title")}
				description={t("description")}
				actions={
					<>
						<span data-tour="reports-range">
							<Segmented
								value={range}
								onChange={setRange}
								options={[
									{ value: "today", label: t("today") },
									{ value: "7d", label: t("last7") },
									{ value: "30d", label: t("last30") },
								]}
							/>
						</span>
						<Button variant="outline" size="lg" onClick={exportCsv} disabled={!data}>
							<Download />
							{t("export")}
						</Button>
					</>
				}
			/>

			<div data-tour="reports-tabs">
				<Segmented
					variant="chips"
					size="lg"
					value={tab}
					onChange={setTab}
					options={[
						{ value: "sales", label: t("tabs.sales") },
						{ value: "products", label: t("tabs.products") },
						{ value: "payments", label: t("tabs.payments") },
						{ value: "employees", label: t("tabs.employees") },
					]}
				/>
			</div>

			{!data ? (
				<ChartSkeleton />
			) : (
				<>
					{tab === "sales" ? (
						<>
							<div className="grid grid-cols-2 gap-3 desktop:grid-cols-4">
								<MetricCard icon={Coins} tone="success" label={t("revenue")} value={formatBaht(data.metrics.revenue)} change={data.metrics.revenueChange} />
								<MetricCard icon={ShoppingBag} tone="primary" label={t("orders")} value={formatNumber(data.metrics.orders)} change={data.metrics.ordersChange} />
								<MetricCard icon={ReceiptText} tone="info" label={t("average")} value={formatBaht(data.metrics.averageOrder)} change={data.metrics.averageOrderChange} />
								<MetricCard icon={PiggyBank} tone="warning" label={t("profit")} value={formatBaht(data.metrics.estimatedProfit)} change={data.metrics.profitChange} />
							</div>
							<div data-tour="reports-profit">
								<ProfitBreakdown metrics={data.metrics} />
							</div>
							<SalesChart height={300} series={data.series} range={range} onRangeChange={setRange} />
							<PeriodTable series={data.series} range={range} />
						</>
					) : null}

					{tab === "products" ? (
						data.topProducts.length === 0 ? (
							<Surface>
								<EmptyState icon={BarChart3} title={t("empty")} />
							</Surface>
						) : (
							<div className="grid gap-4 desktop:grid-cols-2">
								<RevenueBars rows={data.topProducts} />
								<div className="grid gap-4">
									<ProductList title={t("topSelling")} rows={data.topProducts.slice(0, 3)} />
									<ProductList title={t("lowSelling")} rows={data.lowSelling} />
								</div>
							</div>
						)
					) : null}

					{tab === "payments" ? <PaymentBreakdown breakdown={data.paymentBreakdown} /> : null}

					{tab === "employees" ? (
						<Surface className="p-0">
							{data.employees.length === 0 ? (
								<EmptyState icon={BarChart3} title={t("empty")} />
							) : (
								<DataTable columns={perfColumns} rows={data.employees} rowKey={(e) => e.name} />
							)}
						</Surface>
					) : null}
				</>
			)}
		</PageContainer>
	);
}
