"use client";

import { formatNumber, formatThaiDate } from "@posly/utils/format";
import { formatBaht } from "@posly/utils/money";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	type TooltipContentProps,
	XAxis,
	YAxis,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

type Kind = "money" | "count";

/** "฿12K" on the axis; exact figures are in the tooltip. */
const axisValue = (kind: Kind) => (value: number) => {
	const n = kind === "money" ? value / 100 : value;
	const prefix = kind === "money" ? "฿" : "";
	if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
	if (n >= 10_000) return `${prefix}${Math.round(n / 1000)}K`;
	if (n >= 1000) return `${prefix}${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
	return `${prefix}${Math.round(n)}`;
};

const dayOf = (iso: string) => new Date(`${iso}T12:00:00+07:00`);

type Granularity = "day" | "month";

/**
 * Days: bare numbers, the month named on the first tick and where a month starts. Months:
 * the short month, with the year where it changes.
 */
const tickFor = (granularity: Granularity) => (value: string, index: number) => {
	const date = dayOf(value);
	if (granularity === "month") {
		return index === 0 || date.getUTCMonth() === 0
			? formatThaiDate(date, { month: "short", year: "2-digit" })
			: formatThaiDate(date, { month: "short" });
	}
	return index === 0 || date.getUTCDate() === 1
		? formatThaiDate(date, { day: "numeric", month: "short" })
		: String(date.getUTCDate());
};

function ChartTooltip({
	active,
	payload,
	kind,
	label,
	granularity,
}: Pick<TooltipContentProps<ValueType, NameType>, "active" | "payload"> & {
	kind: Kind;
	label: string;
	granularity: Granularity;
}) {
	if (!active || !payload?.length) return null;
	const point = payload[0].payload as { date: string };
	const value = Number(payload[0].value ?? 0);
	return (
		<div className="min-w-40 rounded-xl bg-popover px-3.5 py-3 text-xs shadow-lg ring-1 ring-border">
			<p className="mb-1.5 font-medium text-muted-foreground">
				{granularity === "month"
					? formatThaiDate(dayOf(point.date), { month: "long", year: "numeric" })
					: formatThaiDate(dayOf(point.date), { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
			</p>
			<div className="flex items-center justify-between gap-4">
				<span>{label}</span>
				<span className="numeric font-semibold text-foreground text-sm">
					{kind === "money" ? formatBaht(value) : formatNumber(value)}
				</span>
			</div>
		</div>
	);
}

/**
 * One measure per day, one axis. Money is an area (a running level), counts are bars
 * (discrete events). Single series, so no legend: the card's title names it.
 */
export function DailyChart<T extends { date: string }, K extends keyof T & string>({
	data,
	dataKey,
	kind,
	label,
	color = "var(--chart-1)",
	height = 240,
	granularity = "day",
}: {
	/** "month": each point's `date` is the month's first day (YYYY-MM-01). */
	granularity?: Granularity;
	data: T[];
	dataKey: K;
	kind: Kind;
	label: string;
	color?: string;
	height?: number;
}) {
	const common = {
		data,
		margin: { top: 8, right: 8, bottom: 0, left: 0 },
	};
	const axes = (
		<>
			<CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
			<XAxis
				dataKey="date"
				tickFormatter={tickFor(granularity)}
				tickLine={false}
				axisLine={false}
				minTickGap={16}
				tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
			/>
			<YAxis
				tickFormatter={axisValue(kind)}
				tickLine={false}
				axisLine={false}
				width={52}
				allowDecimals={false}
				tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
			/>
			<Tooltip
				cursor={kind === "money" ? { stroke: "var(--border)" } : { fill: "var(--muted)", opacity: 0.5 }}
				content={(props) => <ChartTooltip {...props} kind={kind} label={label} granularity={granularity} />}
			/>
		</>
	);

	return (
		<div style={{ height }} className="w-full">
			<ResponsiveContainer width="100%" height="100%">
				{/* A level over days reads as an area; months are separate totals, so bars. */}
				{kind === "money" && granularity === "day" ? (
					<AreaChart {...common}>
						<defs>
							<linearGradient id={`fill-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor={color} stopOpacity={0.22} />
								<stop offset="100%" stopColor={color} stopOpacity={0} />
							</linearGradient>
						</defs>
						{axes}
						<Area
							type="monotone"
							dataKey={dataKey as string}
							stroke={color}
							strokeWidth={2}
							fill={`url(#fill-${dataKey})`}
							activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
						/>
					</AreaChart>
				) : (
					<BarChart {...common} barCategoryGap={2}>
						{axes}
						<Bar dataKey={dataKey as string} fill={color} radius={[4, 4, 0, 0]} maxBarSize={18} />
					</BarChart>
				)}
			</ResponsiveContainer>
		</div>
	);
}
