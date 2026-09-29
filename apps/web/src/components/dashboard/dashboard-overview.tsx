"use client";

import { ChartSkeleton, MetricCard, MetricSkeleton, PageContainer, StatTrend } from "@/components/common/primitives";
import { PaymentBreakdown, StockAlerts, TopProducts } from "@/components/dashboard/dashboard-panels";
import { SalesChart } from "@/components/dashboard/sales-chart";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@posly/ui/components/select";
import { useActiveBusiness } from "@/hooks/use-workspace";
import { useNow } from "@/hooks/use-now";
import { formatBaht } from "@posly/utils/money";
import { formatNumber, formatThaiDate, greetingKey } from "@posly/utils/format";
import { EmptyState } from "@/components/common/primitives";
import { Button } from "@posly/ui/components/button";
import { useDashboard } from "@/hooks/use-posly";
import { useRouter } from "@/i18n/navigation";
import type { ReportRange } from "@/lib/api/posly";
import { Coins, PiggyBank, ReceiptText, RotateCcw, ShoppingBag, Sun, Sunset, Moon, TriangleAlert } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

const GREETING_ICON = { morning: Sun, afternoon: Sunset, evening: Moon };

/**
 * The owner's first screen (plan §8): a greeting, four numbers, one chart, then three short
 * lists. Deliberately not everything — detail lives in Reports.
 *
 * On a phone the same data re-flows into the §29 order (hero figure first, then chart, top
 * products, payments, alerts) rather than shrinking the desktop grid.
 */
export function DashboardOverview() {
	const t = useTranslations("dashboard");
	const tErrors = useTranslations("errors");
	const { business, can } = useActiveBusiness();
	const router = useRouter();
	const canSeeReports = can("reports:read");
	// Staff without reports land on the till instead of a dashboard they cannot read.
	useEffect(() => {
		if (!canSeeReports) router.replace("/pos");
	}, [canSeeReports, router]);
	const now = useNow();
	const [period, setPeriod] = useState<ReportRange>("today");
	const dashboard = useDashboard(period, canSeeReports);
	const data = dashboard.data;
	const m = data?.metrics;
	// Each card shows the comparison period's own figure beside the percentage —
	// "yesterday by now ฿7,720 · ↘ 98.9%" — so a drop has a scale, not just a red number.
	const today = period === "today";
	const vs = t(today ? "previousToday" : "previousRange");
	// Before the first sale of the day every comparison reads -100%, which looks like
	// something broke. It is only early: say so, and keep yesterday's figure for context.
	const noSalesYet = today && m?.orders === 0;
	const trendOf = (value: number | null | undefined) => (noSalesYet ? null : value);
	const note = noSalesYet ? t("noSalesYet") : undefined;
	// A day in progress being behind yesterday is ordinary; only finished periods go red.
	const softDecline = today;
	// The comparison figure is context, not a receipt: whole baht keeps the line short.
	const roughBaht = (amount: number) => formatBaht(Math.round(amount / 100) * 100);
	const revenueTrend = data?.series.map((b) => b.revenue);
	const ordersTrend = data?.series.map((b) => b.orders);
	const averageTrend = data?.series.map((b) => (b.orders ? b.revenue / b.orders : 0));
	const greeting = greetingKey(now);
	const GreetingIcon = GREETING_ICON[greeting];

	return (
		<PageContainer>
			<motion.section
				initial={{ opacity: 0, y: 6 }}
				animate={{ opacity: 1, y: 0 }}
				className="hero-surface relative overflow-hidden rounded-3xl px-6 py-7 text-white tablet:px-8 tablet:py-8"
			>
				{/* Light, not a photo: it themes, loads instantly, and never looks like stock art. */}
				<div aria-hidden className="hero-grid pointer-events-none absolute inset-0" />
				<div className="relative flex flex-col gap-4 tablet:flex-row tablet:items-end tablet:justify-between">
					<div className="space-y-1">
						<p className="flex items-center gap-2 font-semibold text-2xl tracking-tight tablet:text-3xl" suppressHydrationWarning>
							{t(`greeting.${greeting}`)}
							<GreetingIcon className="size-6 text-amber-300" />
						</p>
						<p className="text-white/70">{business.name}</p>
					</div>

					<div className="flex items-center gap-2">
						<span className="text-sm text-white/60" suppressHydrationWarning>
							{formatThaiDate(now, { day: "numeric", month: "long", year: "numeric" })}
						</span>
						<Select value={period} onValueChange={(v) => setPeriod(v as ReportRange)}>
							<SelectTrigger className="h-9 data-[size=default]:h-9 min-w-28 rounded-xl border-white/15 bg-white/10 text-white backdrop-blur hover:bg-white/15 [&_svg]:text-white/70">
								<SelectValue />
							</SelectTrigger>
							<SelectContent align="end">
								<SelectItem value="today">{t("range.today")}</SelectItem>
								<SelectItem value="yesterday">{t("range.yesterday")}</SelectItem>
								<SelectItem value="7d">{t("range.7d")}</SelectItem>
								<SelectItem value="30d">{t("range.30d")}</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				{/* The phone's hero figure (plan §29): today's sales, big, before anything else. */}
				{m ? (
				<div className="relative mt-6 tablet:hidden">
					<p className="text-sm text-white/60">{t("todaySales")}</p>
					<p className="numeric font-semibold text-4xl tracking-tight">
						{formatBaht(m.revenue)}
					</p>
					<div className="mt-1 flex items-center gap-3 text-sm">
						{trendOf(m.revenueChange) != null ? (
							<StatTrend
								change={m.revenueChange as number}
								// The hero sits on a dark gradient: light green up, muted down (the day
								// is not over yet).
								className={(m.revenueChange as number) > 0 ? "text-emerald-300" : "text-white/60"}
							/>
						) : null}
						<span className="text-white/60">
							{formatNumber(m.orders)} {t("ordersUnit")}
						</span>
					</div>
					<p className="mt-0.5 text-white/60 text-xs">
						{noSalesYet ? `${t("noSalesYet")} · ` : null}
						{t("previousToday")} <span className="numeric">{roughBaht(m.previousRevenue)}</span>
					</p>
				</div>
				) : null}
			</motion.section>

			{dashboard.isError && !data ? (
				<EmptyState
					icon={TriangleAlert}
					title={tErrors("title")}
					description={tErrors("hint")}
					action={
						<Button size="lg" onClick={() => void dashboard.refetch()}>
							<RotateCcw />
							{tErrors("retry")}
						</Button>
					}
				/>
			) : !data || !m ? (
				<>
					<div className="grid grid-cols-2 gap-3 desktop:grid-cols-4 desktop:gap-4">
						<MetricSkeleton />
						<MetricSkeleton />
						<MetricSkeleton />
						<MetricSkeleton />
					</div>
					<ChartSkeleton />
				</>
			) : (
				<>
					<div className="grid grid-cols-2 gap-3 desktop:grid-cols-4 desktop:gap-4">
						<MetricCard
							tinted
							tone="success"
							icon={Coins}
							label={period === "today" ? t("metrics.revenue") : t("metrics.revenueRange")}
							value={formatBaht(m.revenue)}
							change={trendOf(m.revenueChange)}
							changeLabel={vs}
							previous={roughBaht(m.previousRevenue)}
							softDecline={softDecline}
							note={note}
							trend={revenueTrend}
							className="hidden tablet:flex"
						/>
						<MetricCard
							tinted
							tone="primary"
							icon={ShoppingBag}
							label={t("metrics.orders")}
							value={formatNumber(m.orders)}
							change={trendOf(m.ordersChange)}
							changeLabel={vs}
							previous={formatNumber(m.previousOrders)}
							softDecline={softDecline}
							note={note}
							trend={ordersTrend}
						/>
						<MetricCard
							tinted
							tone="info"
							icon={ReceiptText}
							label={t("metrics.averageOrder")}
							value={formatBaht(m.averageOrder)}
							change={trendOf(m.averageOrderChange)}
							changeLabel={vs}
							previous={roughBaht(m.previousAverageOrder)}
							softDecline={softDecline}
							note={note}
							trend={averageTrend}
						/>
						<MetricCard
							tinted
							tone="warning"
							icon={PiggyBank}
							// Gross, not net: one rent payment recorded today must not make today look
							// like a loss. Net profit lives on the reports page, over whole periods.
							label={t("metrics.profit")}
							value={formatBaht(m.grossProfit)}
							change={trendOf(m.grossProfitChange)}
							changeLabel={vs}
							previous={roughBaht(m.previousGrossProfit)}
							softDecline={softDecline}
							note={note}
							trend={revenueTrend}
							className="col-span-2 tablet:col-span-1"
						/>
					</div>

					<div className="grid gap-4 desktop:grid-cols-5">
						<SalesChart
							className="desktop:col-span-3"
							series={data.series}
							range={period}
							onRangeChange={setPeriod}
						/>
						<TopProducts className="desktop:col-span-2" rows={data.topProducts} />
					</div>

					<div className="grid gap-4 desktop:grid-cols-5">
						<PaymentBreakdown className="desktop:col-span-3" breakdown={data.paymentBreakdown} />
						<StockAlerts className="desktop:col-span-2" alerts={data.lowStock} />
					</div>
				</>
			)}
		</PageContainer>
	);
}
