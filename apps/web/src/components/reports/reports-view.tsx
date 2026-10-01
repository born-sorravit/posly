"use client";

import { type Column, DataTable, Segmented } from "@/components/common/controls";
import { CountUp } from "@/components/motion/count-up";
import { EmptyState, MetricCard, PageContainer, PageHeader, SectionTitle, Surface } from "@/components/common/primitives";
import { ProductThumb } from "@/components/common/product-thumb";
import { PaymentBreakdown } from "@/components/dashboard/dashboard-panels";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { PeriodTable } from "@/components/reports/period-table";
import { ReportTabSkeleton } from "@/components/reports/reports-skeletons";
import { Button } from "@posly/ui/components/button";
import { formatNumber } from "@posly/utils/format";
import { useDashboard, useInsights } from "@/hooks/use-posly";
import type { DashboardDto } from "@/lib/api/posly";
import { CustomerInsights, PeakHours, ProfitInsights } from "@/components/reports/insights";
import {
	type Period,
	type PeriodMode,
	PeriodSummary,
	displayRange,
	initialPeriod,
	toQuery,
	windowLabel,
} from "@/components/reports/period-picker";
import { formatBaht } from "@posly/utils/money";
import { downloadFile, toCsv } from "@/lib/export/csv";
import { AlertTriangle, BarChart3, Coins, Download, Lock, PiggyBank, ReceiptText, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useFeature } from "@/hooks/use-workspace";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type Tab = "sales" | "products" | "peak" | "profit" | "customers" | "payments" | "employees";

/** The tabs that read the Advanced report. */
/** The comparison figure in whole baht: it gives the percentage a scale, not an audit. */
const roughBaht = (amount: number) => formatBaht(Math.round(amount / 100) * 100);

const INSIGHT_TABS = new Set<Tab>(["peak", "profit", "customers"]);

function AdvancedLocked() {
	const t = useTranslations("reports.period");
	return (
		<Surface>
			<EmptyState
				icon={Lock}
				title={t("lockedInsightsTitle")}
				description={t("lockedInsightsHint")}
				action={
					<Button asChild size="lg" className="brand-gradient">
						<Link href="/settings/subscription">{t("upgrade")}</Link>
					</Button>
				}
			/>
		</Surface>
	);
}

/**
 * Where the profit figure comes from, one line per step, so a negative number explains
 * itself: sales − cost of goods = gross profit − expenses = profit after expenses.
 * Without the Expenses feature there is nothing to subtract, and it says so.
 *
 * Beside the steps (below them on a phone), the same sale as one bar: how each ฿100 splits
 * into cost, expenses and what is left. A loss has nothing left, so the bar is scaled to
 * what went out and the shortfall is named instead.
 */
function ProfitBreakdown({ metrics, productsWithoutCost }: { metrics: DashboardDto["metrics"]; productsWithoutCost: number }) {
	const t = useTranslations("reports.breakdown");
	const hasExpenses = useFeature("EXPENSES");
	// VAT added on top of prices is the tax office's, so profit is measured without it.
	const vatAdded = Math.max(0, metrics.revenue - metrics.cost - metrics.grossProfit);
	const sales = metrics.revenue - vatAdded;
	const doubleCounted = hasExpenses && metrics.ingredientExpenses > 0 && metrics.cost > 0;
	const expenses = hasExpenses ? metrics.expenses : 0;
	const profit = hasExpenses ? metrics.estimatedProfit : metrics.grossProfit;
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

	const whole = Math.max(sales, metrics.cost + expenses, 1);
	const parts = [
		{ key: "cost", label: t("cost"), value: metrics.cost, color: "var(--chart-3)" },
		...(hasExpenses ? [{ key: "expenses", label: t("expenses"), value: expenses, color: "var(--chart-5)" }] : []),
		{ key: "profit", label: hasExpenses ? t("net") : t("gross"), value: Math.max(0, profit), color: "var(--success)" },
	].filter((p) => p.value > 0);
	const margin = sales > 0 ? Math.round((profit / sales) * 1000) / 10 : null;
	const share = (value: number) => (sales > 0 ? `${Math.round((value / sales) * 1000) / 10}%` : "–");

	return (
		<Surface>
			<SectionTitle>{t("title")}</SectionTitle>
			<div className="grid gap-6 desktop:grid-cols-2 desktop:gap-10">
				<div className="text-sm">
					{row(t("revenue"), metrics.revenue)}
					{vatAdded > 0 ? row(t("vatAdded"), vatAdded, "minus") : null}
					{row(t("cost"), metrics.cost, "minus")}
					{row(t("gross"), metrics.grossProfit, "total")}
					{hasExpenses ? (
						<>
							{row(t("expenses"), metrics.expenses, "minus")}
							{row(t("net"), metrics.estimatedProfit, "total")}
						</>
					) : null}
				</div>

				<div className="flex flex-col gap-4 desktop:border-border desktop:border-l desktop:pl-10">
					<div>
						<p className="text-muted-foreground text-sm">{hasExpenses ? t("netMargin") : t("grossMargin")}</p>
						<p className={cn("numeric mt-1 font-semibold text-3xl tracking-tight", profit < 0 && "text-danger")}>
							{margin === null ? "–" : `${margin}%`}
						</p>
						<p className="mt-1 text-muted-foreground text-xs">
							{sales <= 0
								? t("noSales")
								: profit < 0
									? t("loss", { amount: formatBaht(-profit) })
									: t("perHundred", { amount: formatBaht(Math.round((profit / sales) * 10_000)) })}
						</p>
					</div>

					{parts.length ? (
						<>
							<div className="flex h-3 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={t("splitLabel")}>
								{parts.map((p) => (
									<span
										key={p.key}
										className="h-full first:rounded-l-full last:rounded-r-full"
										style={{ width: `${(p.value / whole) * 100}%`, backgroundColor: p.color }}
									/>
								))}
							</div>
							<ul className="grid gap-2 text-sm">
								{parts.map((p) => (
									<li key={p.key} className="flex items-center gap-2.5">
										<span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
										<span className="flex-1 text-muted-foreground">{p.label}</span>
										<span className="numeric font-medium">{share(p.value)}</span>
									</li>
								))}
							</ul>
						</>
					) : null}
				</div>
			</div>
			{productsWithoutCost > 0 || doubleCounted ? (
				<div className="mt-4 grid gap-2">
					{productsWithoutCost > 0 ? (
						<p className="flex items-start gap-2 rounded-xl bg-warning/10 px-3.5 py-2.5 text-foreground text-xs leading-relaxed">
							<AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
							<span>
								{t("missingCost", { count: productsWithoutCost })}{" "}
								<Link href="/products" className="font-medium text-primary hover:underline">
									{t("addCost")}
								</Link>
							</span>
						</p>
					) : null}
					{doubleCounted ? (
						<p className="flex items-start gap-2 rounded-xl bg-warning/10 px-3.5 py-2.5 text-foreground text-xs leading-relaxed">
							<AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
							<span>{t("doubleCount", { amount: formatBaht(metrics.ingredientExpenses) })}</span>
						</p>
					) : null}
				</div>
			) : null}
			<p className="mt-4 text-muted-foreground text-xs leading-relaxed">
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
	const [period, setPeriod] = useState<Period>(initialPeriod);
	const advanced = useFeature("ADVANCED_REPORT");
	const query = toQuery(period, advanced);
	const { data } = useDashboard(query);
	const insights = useInsights(query, advanced && INSIGHT_TABS.has(tab));
	/** What the chart and the table are drawn as; the requested range until the data arrives. */
	const range = data ? displayRange(data) : period.preset;
	const choosePreset = (preset: Period["preset"]) => setPeriod((p) => ({ ...p, mode: preset, preset }));
	const chooseMode = (mode: PeriodMode) =>
		mode === "custom" ? setPeriod((p) => ({ ...p, mode })) : choosePreset(mode);
	const tBreakdown = useTranslations("reports.breakdown");
	const tPeriod = useTranslations("reports.period");
	/** The line under each headline card names what it is compared with. */
	const versus = tPeriod(query.compare === "year" ? "compareYear" : "comparePrevious");
	const revenueTrend = data?.series.map((b) => b.revenue);
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
			[t("title"), windowLabel(data.from, data.days)],
			[],
			[t("revenue"), baht(m.revenue)],
			[t("orders"), m.orders],
			[t("average"), baht(m.averageOrder)],
			...(m.revenue - m.cost - m.grossProfit > 0 ? [[tBreakdown("vatAdded"), baht(m.revenue - m.cost - m.grossProfit)]] : []),
			[tBreakdown("cost"), baht(m.cost)],
			[tBreakdown("gross"), baht(m.grossProfit)],
			[tBreakdown("expenses"), baht(m.expenses)],
			[tBreakdown("net"), baht(m.estimatedProfit)],
			[],
			[data.days === 1 ? t("time") : t("date"), t("orders"), t("revenue")],
			...data.series.map((b) => [data.days === 1 ? b.label : b.date, b.orders, baht(b.revenue)]),
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
		const name = data.range === "custom" ? `${query.from}_${query.to}` : `${data.range}-${day}`;
		downloadFile(`posly-report-${name}.csv`, toCsv(rows));
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
								value={period.mode}
								onChange={chooseMode}
								options={[
									{ value: "today", label: t("today") },
									{ value: "7d", label: t("last7") },
									{ value: "30d", label: t("last30") },
									{ value: "custom", label: t("custom") },
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

			<PeriodSummary period={period} onChange={setPeriod} data={data} advanced={advanced} />

			<div data-tour="reports-tabs">
				<Segmented
					variant="chips"
					size="lg"
					value={tab}
					onChange={setTab}
					options={[
						{ value: "sales", label: t("tabs.sales") },
						{ value: "products", label: t("tabs.products") },
						{ value: "peak", label: t("tabs.peak") },
						{ value: "profit", label: t("tabs.profit") },
						{ value: "customers", label: t("tabs.customers") },
						{ value: "payments", label: t("tabs.payments") },
						{ value: "employees", label: t("tabs.employees") },
					]}
				/>
			</div>

			{INSIGHT_TABS.has(tab) ? (
				!advanced ? (
					<AdvancedLocked />
				) : !insights.data ? (
					<ReportTabSkeleton tab={tab} />
				) : tab === "peak" ? (
					<PeakHours data={insights.data} />
				) : tab === "profit" ? (
					<ProfitInsights data={insights.data} />
				) : (
					<CustomerInsights data={insights.data} />
				)
			) : !data ? (
				<ReportTabSkeleton tab={tab} />
			) : (
				<>
					{tab === "sales" ? (
						<>
							{/* The same headline cards as the dashboard: tinted, with the period's line under each. */}
							<div className="grid grid-cols-2 gap-3 desktop:grid-cols-4 desktop:gap-4">
								<MetricCard
									tinted
									tone="success"
									icon={Coins}
									label={t("revenue")}
									value={<CountUp value={data.metrics.revenue} format={formatBaht} step={100} />}
									change={data.metrics.revenueChange}
									changeLabel={versus}
									previous={roughBaht(data.metrics.previousRevenue)}
									trend={revenueTrend}
								/>
								<MetricCard
									tinted
									tone="primary"
									icon={ShoppingBag}
									label={t("orders")}
									value={<CountUp value={data.metrics.orders} format={formatNumber} />}
									change={data.metrics.ordersChange}
									changeLabel={versus}
									previous={formatNumber(data.metrics.previousOrders)}
									trend={data.series.map((b) => b.orders)}
								/>
								<MetricCard
									tinted
									tone="info"
									icon={ReceiptText}
									label={t("average")}
									value={<CountUp value={data.metrics.averageOrder} format={formatBaht} step={100} />}
									change={data.metrics.averageOrderChange}
									changeLabel={versus}
									previous={roughBaht(data.metrics.previousAverageOrder)}
									trend={data.series.map((b) => (b.orders > 0 ? b.revenue / b.orders : 0))}
								/>
								<MetricCard
									tinted
									tone="warning"
									icon={PiggyBank}
									label={t("profit")}
									value={<CountUp value={data.metrics.estimatedProfit} format={formatBaht} step={100} />}
									change={data.metrics.profitChange}
									changeLabel={versus}
									previous={roughBaht(data.metrics.previousEstimatedProfit)}
									trend={revenueTrend}
								/>
							</div>
							<div data-tour="reports-profit">
								<ProfitBreakdown metrics={data.metrics} productsWithoutCost={data.productsWithoutCost} />
							</div>
							<SalesChart
								height={300}
								series={data.series}
								range={range}
								onRangeChange={
									data.range === "custom" ? undefined : (r) => choosePreset(r === "yesterday" ? "today" : r)
								}
							/>
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
