"use client";

import { EmptyState, MetricCard, SectionTitle, Surface } from "@/components/common/primitives";
import { EXPENSE_CATEGORIES } from "@/components/expenses/expense-categories";
import { ExpenseInsightsSkeleton } from "@/components/expenses/expense-skeletons";
import { CountUp } from "@/components/motion/count-up";
import type { ExpenseCategory, ExpenseSummaryDto } from "@/lib/api/posly";
import { formatNumber, formatThaiDate } from "@posly/utils/format";
import { formatBaht } from "@posly/utils/money";
import { CalendarDays, Percent, ReceiptText, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	type TooltipContentProps,
	XAxis,
	YAxis,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

type Unit = "day" | "week" | "month";
type Bucket = { key: string; from: string; to: string; total: number } & Partial<Record<ExpenseCategory, number>>;

const DAY = 86_400_000;
const parse = (date: string) => Date.parse(`${date}T00:00:00Z`);
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const days = (from: string, to: string) => Math.round((parse(to) - parse(from)) / DAY) + 1;
const shift = (date: string, n: number) => iso(parse(date) + n * DAY);
const asDate = (date: string) => new Date(`${date}T12:00:00+07:00`);
const todayInBangkok = () =>
	new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(
		new Date()
	);

/** The bucket a day falls in: itself, its week's Monday, or its month's 1st. */
const bucketOf = (date: string, unit: Unit) => {
	if (unit === "day") return date;
	if (unit === "month") return `${date.slice(0, 8)}01`;
	const weekday = (new Date(parse(date)).getUTCDay() + 6) % 7;
	return shift(date, -weekday);
};
const nextBucket = (key: string, unit: Unit) => {
	if (unit === "day") return shift(key, 1);
	if (unit === "week") return shift(key, 7);
	const [y, m] = key.split("-").map(Number);
	return iso(Date.UTC(y, m, 1));
};

/**
 * The bars, every bucket in the window drawn — an empty day is part of the picture. A month
 * reads day by day, a quarter week by week, and "all time" month by month, so the chart
 * never has more than about sixty bars. The window stops at today: next week has no costs yet.
 */
const bucketize = (summary: ExpenseSummaryDto, from?: string, to?: string) => {
	const today = todayInBangkok();
	const start = from ?? summary.byDay[0]?.date ?? today;
	const last = summary.byDay.at(-1)?.date ?? today;
	// Through today (or the last expense, if one is dated later), but never past the range.
	let end = last > today ? last : today;
	if (to && end > to) end = to;
	if (end < start) end = start;
	const span = days(start, end);
	const unit: Unit = span <= 62 ? "day" : span <= 190 ? "week" : "month";
	const buckets: Bucket[] = [];
	const index = new Map<string, Bucket>();
	for (let key = bucketOf(start, unit); key <= end; key = nextBucket(key, unit)) {
		const next = nextBucket(key, unit);
		const bucket: Bucket = { key, from: key < start ? start : key, to: shift(next, -1) > end ? end : shift(next, -1), total: 0 };
		buckets.push(bucket);
		index.set(key, bucket);
	}
	for (const day of summary.byDay) {
		const bucket = index.get(bucketOf(day.date, unit));
		if (!bucket) continue;
		for (const [category, amount] of Object.entries(day.byCategory) as [ExpenseCategory, number][]) {
			bucket[category] = (bucket[category] ?? 0) + amount;
			bucket.total += amount;
		}
	}
	return { buckets, unit, start, end };
};

/** "฿12K" on the axis; exact figures are in the tooltip. */
const axisBaht = (satang: number) => {
	const baht = satang / 100;
	if (baht >= 10_000) return `฿${Math.round(baht / 1000)}K`;
	if (baht >= 1000) return `฿${(baht / 1000).toFixed(1).replace(/\.0$/, "")}K`;
	return `฿${Math.round(baht)}`;
};

/** A ratio counted in tenths of a percent, so the count lands on the one decimal shown. */
const tenthsPercent = (tenths: number) => `${tenths / 10}%`;

function TrendTooltip({
	active,
	payload,
	unit,
}: Pick<TooltipContentProps<ValueType, NameType>, "active" | "payload"> & { unit: Unit }) {
	const t = useTranslations("expenses");
	if (!active || !payload?.length) return null;
	const bucket = payload[0].payload as Bucket;
	const heading =
		unit === "day"
			? formatThaiDate(asDate(bucket.from), { weekday: "long", day: "numeric", month: "long", year: "numeric" })
			: unit === "week"
				? t("insights.weekOf", {
						from: formatThaiDate(asDate(bucket.from), { day: "numeric", month: "short" }),
						to: formatThaiDate(asDate(bucket.to), { day: "numeric", month: "short" }),
					})
				: formatThaiDate(asDate(bucket.from), { month: "long", year: "numeric" });
	const parts = EXPENSE_CATEGORIES.filter((c) => (bucket[c.value] ?? 0) > 0);
	return (
		<div className="min-w-52 rounded-xl bg-popover px-3.5 py-3 text-xs shadow-lg ring-1 ring-border">
			<p className="mb-2 font-medium text-muted-foreground">{heading}</p>
			{parts.length ? (
				<dl className="grid gap-1.5">
					{parts.map((c) => (
						<div key={c.value} className="flex items-center justify-between gap-4">
							<dt className="flex items-center gap-2">
								<span className="size-2 rounded-full" style={{ background: c.color }} aria-hidden />
								{t(`categories.${c.value}`)}
							</dt>
							<dd className="numeric font-medium text-foreground">{formatBaht(bucket[c.value] ?? 0)}</dd>
						</div>
					))}
					{parts.length > 1 ? (
						<div className="mt-0.5 flex items-center justify-between gap-4 border-border/60 border-t pt-1.5">
							<dt className="pl-4 text-muted-foreground">{t("insights.sum")}</dt>
							<dd className="numeric font-semibold text-foreground text-sm">{formatBaht(bucket.total)}</dd>
						</div>
					) : null}
				</dl>
			) : (
				<p className="text-muted-foreground">{t("insights.emptyChart")}</p>
			)}
		</div>
	);
}

/** Stacked bars over the window, one colour per category, the same hues as the list's icons. */
function ExpenseTrend({ summary, from, to }: { summary: ExpenseSummaryDto; from?: string; to?: string }) {
	const t = useTranslations("expenses");
	const { buckets, unit } = bucketize(summary, from, to);
	const present = EXPENSE_CATEGORIES.filter((c) => (summary.byCategory[c.value] ?? 0) > 0);
	const tick = (key: string, index: number) => {
		const date = asDate(key);
		if (unit === "month") return formatThaiDate(date, { month: "short", year: "2-digit" });
		if (unit === "week") return formatThaiDate(date, { day: "numeric", month: "short" });
		return index === 0 || date.getUTCDate() === 1
			? formatThaiDate(date, { day: "numeric", month: "short" })
			: String(date.getUTCDate());
	};

	return (
		<Surface className="flex flex-col desktop:col-span-2">
			<SectionTitle>{t("insights.trend")}</SectionTitle>
			<p className="-mt-2 mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-muted-foreground text-xs">
				<span>
					{unit === "day" ? t("insights.trendDaily") : unit === "week" ? t("insights.trendWeekly") : t("insights.trendMonthly")}
				</span>
				{present.map((c) => (
					<span key={c.value} className="flex items-center gap-1.5">
						<span className="size-2 rounded-sm" style={{ background: c.color }} aria-hidden />
						{t(`categories.${c.value}`)}
					</span>
				))}
			</p>
			{present.length === 0 ? (
				<EmptyState icon={CalendarDays} title={t("insights.emptyChart")} className="py-10" />
			) : (
				// Grows to the donut card's height beside it on desktop, so neither card has a gap.
				<div className="-ml-2 h-64 desktop:h-auto desktop:min-h-64 desktop:flex-1">
					<ResponsiveContainer width="100%" height="100%">
						<BarChart data={buckets} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
							<CartesianGrid vertical={false} stroke="var(--border)" />
							<XAxis
								dataKey="key"
								tickLine={false}
								axisLine={false}
								tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
								interval="preserveStartEnd"
								minTickGap={16}
								tickFormatter={tick}
							/>
							<YAxis
								tickLine={false}
								axisLine={false}
								width={52}
								tickFormatter={axisBaht}
								tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
							/>
							<Tooltip
								cursor={{ fill: "var(--muted)", opacity: 0.5 }}
								content={({ active, payload }) => <TrendTooltip active={active} payload={payload} unit={unit} />}
							/>
							{present.map((c) => (
								<Bar
									key={c.value}
									dataKey={c.value}
									stackId="spend"
									fill={c.color}
									maxBarSize={unit === "day" ? 18 : 32}
									animationDuration={500}
								/>
							))}
						</BarChart>
					</ResponsiveContainer>
				</div>
			)}
		</Surface>
	);
}

/** Where the money went: a donut, and beside it every category with its share and amount. */
function ExpenseSplit({ summary }: { summary: ExpenseSummaryDto }) {
	const t = useTranslations("expenses");
	const rows = EXPENSE_CATEGORIES.map((c) => ({ ...c, amount: summary.byCategory[c.value] ?? 0 }))
		.filter((c) => c.amount > 0)
		.sort((a, b) => b.amount - a.amount)
		.map((c) => ({ ...c, share: c.amount / summary.total, label: t(`categories.${c.value}`) }));

	return (
		<Surface>
			<SectionTitle>{t("insights.split")}</SectionTitle>
			{rows.length === 0 ? (
				<EmptyState icon={Wallet} title={t("insights.emptyChart")} className="py-10" />
			) : (
				<div className="flex flex-col items-center gap-5">
					<div className="relative size-40 shrink-0">
						<ResponsiveContainer width="100%" height="100%">
							<PieChart>
								<Pie
									data={rows}
									dataKey="amount"
									nameKey="label"
									innerRadius="68%"
									outerRadius="100%"
									paddingAngle={rows.length > 1 ? 2 : 0}
									cornerRadius={4}
									stroke="var(--card)"
									strokeWidth={2}
									startAngle={90}
									endAngle={-270}
									animationDuration={400}
								>
									{rows.map((row) => (
										<Cell key={row.value} fill={row.color} />
									))}
								</Pie>
								<Tooltip
									formatter={(value) => formatBaht(Number(value))}
									contentStyle={{
										borderRadius: 12,
										border: "none",
										background: "var(--popover)",
										boxShadow: "var(--shadow-lg)",
										fontSize: 12,
									}}
								/>
							</PieChart>
						</ResponsiveContainer>
						<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
							<span className="text-[11px] text-muted-foreground">{t("insights.largest")}</span>
							<span className="numeric font-semibold text-lg leading-tight">{Math.round(rows[0].share * 100)}%</span>
							<span className="max-w-24 truncate text-[11px] text-muted-foreground">{rows[0].label}</span>
						</div>
					</div>
					<ul className="grid w-full gap-3">
						{rows.map((row) => {
							const Icon = row.icon;
							return (
								<li key={row.value} className="grid gap-1.5">
									<div className="flex items-center gap-2.5 text-sm">
										<span className={`flex size-6 shrink-0 items-center justify-center rounded-md ${row.ink}`}>
											<Icon className="size-3.5" />
										</span>
										<span className="flex-1 truncate">{row.label}</span>
										<span className="numeric w-12 text-right text-muted-foreground">
											{Math.round(row.share * 1000) / 10}%
										</span>
										<span className="numeric w-24 text-right font-medium">{formatBaht(row.amount)}</span>
									</div>
									{/* The share as a length too, so neighbours compare at a glance. */}
									<div className="ml-8.5 h-1.5 overflow-hidden rounded-full bg-muted">
										<div className="h-full rounded-full" style={{ width: `${row.share * 100}%`, background: row.color }} />
									</div>
								</li>
							);
						})}
					</ul>
				</div>
			)}
		</Surface>
	);
}

/**
 * The expenses page above its list: four figures, then the spend over time and by category.
 * Everything follows the page's period and category filters.
 */
export function ExpenseInsights({
	summary,
	from,
	to,
}: {
	summary: ExpenseSummaryDto | undefined;
	from?: string;
	to?: string;
}) {
	const t = useTranslations("expenses");
	if (!summary) return <ExpenseInsightsSkeleton />;

	const { buckets, start, end } = bucketize(summary, from, to);
	const elapsed = days(start, end);
	const change =
		summary.previousTotal !== null && summary.previousTotal > 0
			? Math.round(((summary.total - summary.previousTotal) / summary.previousTotal) * 1000) / 1000
			: null;
	const ofSales = summary.revenue ? Math.round((summary.total / summary.revenue) * 1000) : null;

	return (
		<>
			<div className="grid grid-cols-2 gap-3 desktop:grid-cols-4 desktop:gap-4" data-tour="expenses-summary">
				<MetricCard
					tinted
					tone="danger"
					icon={Wallet}
					label={t("insights.total")}
					value={<CountUp value={summary.total} format={formatBaht} step={100} />}
					change={change}
					inverse
					changeLabel={t("insights.vsPrevious")}
					previous={summary.previousTotal !== null ? formatBaht(summary.previousTotal) : undefined}
					trend={buckets.map((b) => b.total)}
				/>
				<MetricCard
					tinted
					tone="primary"
					icon={ReceiptText}
					label={t("insights.count")}
					value={<CountUp value={summary.count} format={formatNumber} />}
					note={t("insights.countNote", { count: summary.byDay.length })}
				/>
				<MetricCard
					tinted
					tone="info"
					icon={CalendarDays}
					label={t("insights.perDay")}
					value={<CountUp value={Math.round(summary.total / elapsed)} format={formatBaht} step={100} />}
					note={t("insights.perDayNote", { days: formatNumber(elapsed) })}
				/>
				<MetricCard
					tinted
					tone="warning"
					icon={Percent}
					label={t("insights.ofSales")}
					value={ofSales === null ? "–" : <CountUp value={ofSales} format={tenthsPercent} />}
					note={
						summary.revenue === null
							? t("insights.ofSalesNone")
							: summary.revenue === 0
								? t("insights.ofSalesNoSales")
								: t("insights.ofSalesNote", { revenue: formatBaht(summary.revenue) })
					}
				/>
			</div>
			<div className="grid gap-4 desktop:grid-cols-3">
				<ExpenseTrend summary={summary} from={from} to={to} />
				<ExpenseSplit summary={summary} />
			</div>
		</>
	);
}
