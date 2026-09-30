"use client";

import { Segmented } from "@/components/common/controls";
import { SectionTitle, Surface } from "@/components/common/primitives";
import { formatBaht } from "@posly/utils/money";
import { formatNumber, formatThaiDate } from "@posly/utils/format";
import type { ReportRange } from "@/lib/api/posly";
import { useTranslations } from "next-intl";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	type TooltipContentProps,
	XAxis,
	YAxis,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

export type SalesRange = ReportRange;

/**
 * A day's hourly series runs 00–23, but a shop that opens at 7 and closes at 7 would spend
 * half the chart on flat zeros. Keep one empty hour either side of the trading hours.
 */
export const trimHours = <T extends { revenue: number; orders: number }>(
	series: T[],
	range: ReportRange
): T[] => {
	if (range !== "today" && range !== "yesterday") return series;
	const first = series.findIndex((b) => b.orders > 0);
	if (first === -1) return series.slice(6, 22);
	const last = series.length - 1 - [...series].reverse().findIndex((b) => b.orders > 0);
	return series.slice(Math.max(0, first - 1), Math.min(series.length, last + 2));
};

/** "฿12K" on the axis — the currency says what is being measured; exact figures are in the tooltip. */
const axisBaht = (satang: number) => {
	const baht = satang / 100;
	if (baht >= 10_000) return `฿${Math.round(baht / 1000)}K`;
	// One decimal below ฿10k, or ฿1,350 and ฿1,800 would both read "1K".
	if (baht >= 1000) return `฿${(baht / 1000).toFixed(1).replace(/\.0$/, "")}K`;
	return `฿${Math.round(baht)}`;
};

type Point = { label: string; date: string; revenue: number; orders: number };

const todayInBangkok = () =>
	new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(
		new Date()
	);

const hourly = (range: ReportRange) => range === "today" || range === "yesterday";
const dayOf = (iso: string) => new Date(`${iso}T12:00:00+07:00`);

/**
 * X-axis ticks a person reads without thinking: "07:00" for hours; "จ. 22" across a week;
 * and across a month the bare day number, with the month named where it starts ("1 ก.ย.")
 * and on the first tick, so "30, 1, 3" never looks like a mistake.
 */
const tickFormatter = (range: ReportRange, data: Point[]) => (value: string, index: number) => {
	if (hourly(range)) return `${value}:00`;
	const point = data.find((p) => p.label === value) ?? data[index];
	if (!point) return value;
	const date = dayOf(point.date);
	if (range === "7d") return formatThaiDate(date, { weekday: "short", day: "numeric" });
	return index === 0 || date.getUTCDate() === 1 ? formatThaiDate(date, { day: "numeric", month: "short" }) : value;
};

/** The tooltip's heading: the exact period the point covers. */
const periodLabel = (range: ReportRange, point: Point) => {
	if (hourly(range)) {
		const next = String((Number(point.label) + 1) % 24).padStart(2, "0");
		return `${formatThaiDate(dayOf(point.date), { weekday: "short", day: "numeric", month: "short" })} · ${point.label}:00–${next}:00`;
	}
	return formatThaiDate(dayOf(point.date), { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};

function SalesTooltip({
	active,
	payload,
	range,
}: Pick<TooltipContentProps<ValueType, NameType>, "active" | "payload"> & { range: ReportRange }) {
	const t = useTranslations("dashboard");
	if (!active || !payload?.length) return null;
	const point = payload[0].payload as Point;
	return (
		<div className="min-w-48 rounded-xl bg-popover px-3.5 py-3 text-xs shadow-lg ring-1 ring-border">
			<p className="mb-2 font-medium text-muted-foreground">{periodLabel(range, point)}</p>
			<dl className="grid gap-1.5">
				<div className="flex items-center justify-between gap-4">
					<dt className="flex items-center gap-2">
						<span className="size-2 rounded-full bg-success" aria-hidden />
						{t("chart.revenue")}
					</dt>
					<dd className="numeric font-semibold text-foreground text-sm">{formatBaht(point.revenue)}</dd>
				</div>
				<div className="flex items-center justify-between gap-4 text-muted-foreground">
					<dt className="pl-4">{t("chart.orders")}</dt>
					<dd className="numeric">{formatNumber(point.orders)}</dd>
				</div>
				<div className="flex items-center justify-between gap-4 text-muted-foreground">
					<dt className="pl-4">{t("chart.average")}</dt>
					<dd className="numeric">
						{point.orders ? formatBaht(Math.round(point.revenue / point.orders)) : "—"}
					</dd>
				</div>
			</dl>
			{/* The last day of a range is today: its number is still growing, not a drop. */}
			{!hourly(range) && point.date === todayInBangkok() ? (
				<p className="mt-2 border-border/60 border-t pt-2 text-[11px] text-warning">{t("chart.partialDay")}</p>
			) : null}
		</div>
	);
}

/**
 * One series, one axis: revenue over the chosen range. Single-series, so no legend — the
 * title names it. Orders ride along in the tooltip rather than on a second y-axis.
 */
export function SalesChart({
	className,
	height = 260,
	series,
	range,
	onRangeChange,
}: {
	className?: string;
	height?: number;
	series: Point[];
	range: SalesRange;
	/** Absent when the page picks the period itself (a custom range): no preset switcher then. */
	onRangeChange?: (range: SalesRange) => void;
}) {
	const t = useTranslations("dashboard");
	const data = trimHours(series, range);
	const total = data.reduce((sum, p) => ({ revenue: sum.revenue + p.revenue, orders: sum.orders + p.orders }), {
		revenue: 0,
		orders: 0,
	});

	return (
		<Surface className={className}>
			<SectionTitle
				action={
					onRangeChange ? (
					<Segmented
						size="sm"
						value={range === "yesterday" ? "today" : range}
						onChange={onRangeChange}
						options={[
							{ value: "today", label: t("range.today") },
							{ value: "7d", label: t("range.7d") },
							{ value: "30d", label: t("range.30d") },
						]}
					/>
					) : undefined
				}
			>
				{t("salesOverview")}
			</SectionTitle>
			{/* Say what the chart measures and what it adds up to, before anyone reads an axis. */}
			<p className="-mt-2 mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
				<span className="flex items-center gap-1.5">
					<span className="h-0.5 w-3 rounded-full bg-success" aria-hidden />
					{hourly(range) ? t("chart.legendHourly") : t("chart.legendDaily")}
				</span>
				<span>
					{t("chart.total")}{" "}
					<span className="numeric font-semibold text-foreground">{formatBaht(total.revenue)}</span>
					{" · "}
					<span className="numeric">{formatNumber(total.orders)}</span> {t("ordersUnit")}
				</span>
			</p>

			<div style={{ height }} className="-ml-2">
				<ResponsiveContainer width="100%" height="100%">
					<AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
						<defs>
							<linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor="var(--success)" stopOpacity={0.22} />
								<stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
							</linearGradient>
						</defs>
						<CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
						<XAxis
							dataKey="label"
							tickLine={false}
							axisLine={false}
							tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
							interval="preserveStartEnd"
							minTickGap={20}
							tickFormatter={tickFormatter(range, data)}
						/>
						<YAxis
							tickLine={false}
							axisLine={false}
							width={52}
							tickFormatter={axisBaht}
							tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
						/>
						<Tooltip
							// Rendered as an element, not called as a function, so its hooks are legal.
							content={(props) => <SalesTooltip active={props.active} payload={props.payload} range={range} />}
							cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
						/>
						<Area
							type="monotone"
							dataKey="revenue"
							stroke="var(--success)"
							strokeWidth={2}
							fill="url(#sales-fill)"
							dot={data.length <= 12 && range !== "today" ? { r: 4, fill: "var(--success)", stroke: "var(--card)", strokeWidth: 2 } : false}
							activeDot={{ r: 5, fill: "var(--success)", stroke: "var(--card)", strokeWidth: 2 }}
							animationDuration={400}
						/>
					</AreaChart>
				</ResponsiveContainer>
			</div>
		</Surface>
	);
}
