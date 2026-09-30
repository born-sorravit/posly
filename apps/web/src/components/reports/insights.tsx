"use client";

import { type Column, DataTable, Segmented } from "@/components/common/controls";
import { EmptyState, MetricCard, SectionTitle, StatusBadge, Surface } from "@/components/common/primitives";
import { ProductThumb } from "@/components/common/product-thumb";
import type { InsightsCustomerRow, InsightsDto } from "@/lib/api/posly";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { formatNumber, formatThaiDate } from "@posly/utils/format";
import { formatBaht } from "@posly/utils/money";
import { BarChart3, Coins, Grid3x3, Percent, PiggyBank, Repeat, UserPlus, Users, UserSearch, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
/** Monday-first, like the heatmap rows. 2024-01-01 was a Monday. */
const dayName = (dow: number, weekday: "short" | "long" = "short") =>
	formatThaiDate(new Date(Date.UTC(2024, 0, dow, 5)), { weekday });
const hourSpan = (hour: number) => `${String(hour).padStart(2, "0")}:00–${String((hour + 1) % 24).padStart(2, "0")}:00`;

/**
 * Each measure keeps its colour everywhere on the page: money is the sales green, orders the
 * brand purple — the bars, the grid ramp (`--heat-*` / `--heat-count-*`, both validated in
 * globals.css) and the weekday bars all follow the toggle. Empty grid cells are muted.
 */
const RAMP = {
	revenue: ["bg-heat-1", "bg-heat-2", "bg-heat-3", "bg-heat-4", "bg-heat-5"],
	orders: ["bg-heat-count-1", "bg-heat-count-2", "bg-heat-count-3", "bg-heat-count-4", "bg-heat-count-5"],
} as const;
const COLOR = { revenue: "var(--success)", orders: "var(--chart-1)" } as const;
const BAR = { revenue: "bg-success", orders: "bg-chart-1" } as const;
const EMPTY = "bg-muted";
/** Any sale lands on the first step; the busiest slot is always the last. */
const heatOf = (metric: "orders" | "revenue", value: number, max: number) => {
	const ramp = RAMP[metric];
	return value <= 0 || max <= 0 ? EMPTY : ramp[Math.min(ramp.length - 1, Math.max(0, Math.ceil((value / max) * ramp.length) - 1))];
};

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);

type Metric = "orders" | "revenue";
type Active = { dow: number; hour: number; x: number; y: number };
type View = "chart" | "grid";
/** "all" is every day of the window together; 1–7 is one weekday (isodow). */
type Day = "all" | `${(typeof DAYS)[number]}`;

const VIEW_KEY = "posly:peak-view";

/** "฿12K" on the axis; the exact figure is in the tooltip. */
const axisBaht = (satang: number) => {
	const baht = satang / 100;
	if (baht >= 10_000) return `฿${Math.round(baht / 1000)}K`;
	if (baht >= 1000) return `฿${(baht / 1000).toFixed(1).replace(/\.0$/, "")}K`;
	return `฿${Math.round(baht)}`;
};

/**
 * When the shop sells: weekday × hour, each cell the average for one such day (the total over
 * how many Mondays, Tuesdays… the window holds), so a range with five Mondays and four
 * Sundays does not favour Monday. Quiet by design — small cells, one hue, no figures in the
 * grid; pointing at (or tapping) a cell opens a label with its numbers. Rows are days on a
 * wide screen; on a phone the grid turns so the seven days fit across.
 */
export function PeakHours({ data }: { data: InsightsDto }) {
	const t = useTranslations("reports.insights");
	const [metric, setMetric] = useState<Metric>("orders");
	const [active, setActive] = useState<Active | null>(null);
	// The chosen view is a per-viewer convenience: remembered in this browser, fine to lose.
	// Read on first render: this panel only mounts in the browser, once the insights arrive.
	const [view, setView] = useState<View>(() => {
		try {
			return localStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "chart";
		} catch {
			return "chart";
		}
	});
	const [day, setDay] = useState<Day>("all");
	const chooseView = (next: View) => {
		setView(next);
		setActive(null);
		try {
			localStorage.setItem(VIEW_KEY, next);
		} catch {}
	};

	const { grid, hours, max, top, byDay } = useMemo(() => {
		const { cells, weeks } = data.heatmap;
		const avg = (dow: number, total: number) => (weeks[dow - 1] ? total / weeks[dow - 1] : 0);
		const grid = new Map<string, { orders: number; revenue: number }>();
		for (const c of cells) {
			grid.set(`${c.dow}-${c.hour}`, { orders: avg(c.dow, c.orders), revenue: avg(c.dow, c.revenue) });
		}
		const traded = cells.map((c) => c.hour);
		const first = traded.length ? Math.min(...traded) : 8;
		const last = traded.length ? Math.max(...traded) : 20;
		const hours = Array.from({ length: last - first + 1 }, (_, i) => first + i);
		const max = Math.max(0, ...[...grid.values()].map((v) => v[metric]));
		const top = cells
			.map((c) => ({ dow: c.dow, hour: c.hour, ...grid.get(`${c.dow}-${c.hour}`)! }))
			.sort((a, b) => b[metric] - a[metric])
			.slice(0, 3);
		const byDay = DAYS.map((dow) => {
			const day = cells.filter((c) => c.dow === dow);
			return {
				dow,
				orders: avg(dow, day.reduce((s, c) => s + c.orders, 0)),
				revenue: avg(dow, day.reduce((s, c) => s + c.revenue, 0)),
			};
		});
		return { grid, hours, max, top, byDay };
	}, [data, metric]);

	/**
	 * The bar chart's series: per hour, the average for the chosen weekday, or across every day
	 * of the window ("ทุกวัน" — totals over the number of days, so it matches the grid's scale).
	 */
	const hourly = useMemo(() => {
		const { cells, weeks } = data.heatmap;
		const days = weeks.reduce((sum, n) => sum + n, 0) || 1;
		return hours.map((hour) => {
			const at = cells.filter((c) => c.hour === hour && (day === "all" || c.dow === Number(day)));
			const divisor = day === "all" ? days : weeks[Number(day) - 1] || 1;
			return {
				hour,
				label: String(hour).padStart(2, "0"),
				orders: at.reduce((sum, c) => sum + c.orders, 0) / divisor,
				revenue: at.reduce((sum, c) => sum + c.revenue, 0) / divisor,
			};
		});
	}, [data, hours, day]);
	const best = hourly.reduce<(typeof hourly)[number] | null>(
		(top, h) => (h[metric] > 0 && (!top || h[metric] > top[metric]) ? h : top),
		null
	);

	if (data.heatmap.cells.length === 0) {
		return (
			<Surface>
				<EmptyState icon={Users} title={t("empty")} />
			</Surface>
		);
	}

	const value = (v: { orders: number; revenue: number }) =>
		metric === "orders"
			? t("avgOrders", { count: formatNumber(Math.round(v.orders * 10) / 10) })
			: formatBaht(Math.round(v.revenue));
	/** The figure bold, its unit quiet, right-aligned — easier to scan down a column. */
	const figure = (v: { orders: number; revenue: number }) => (
		<span className="numeric shrink-0 text-right">
			{metric === "orders" ? (
				<>
					<span className="font-semibold text-base">{formatNumber(Math.round(v.orders * 10) / 10)}</span>{" "}
					<span className="text-muted-foreground text-xs">{t("ordersUnit")}</span>
				</>
			) : (
				<span className="font-semibold text-base">{formatBaht(Math.round(v.revenue))}</span>
			)}
		</span>
	);
	const cellAt = (dow: number, hour: number) => grid.get(`${dow}-${hour}`) ?? { orders: 0, revenue: 0 };
	const dayMax = Math.max(0, ...byDay.map((d) => d[metric]));

	/** Anchor the label above the cell, kept inside the card so it never runs off a phone. */
	const point = (dow: number, hour: number) => (e: { currentTarget: HTMLElement }) => {
		const cell = e.currentTarget.getBoundingClientRect();
		const box = e.currentTarget.closest("[data-grid]")!.getBoundingClientRect();
		const x = Math.min(Math.max(cell.left + cell.width / 2 - box.left, 80), box.width - 80);
		setActive({ dow, hour, x, y: cell.top - box.top });
	};

	const cell = (dow: number, hour: number) => {
		const v = cellAt(dow, hour);
		const selected = active?.dow === dow && active.hour === hour;
		return (
			<button
				key={`${dow}-${hour}`}
				type="button"
				aria-label={`${dayName(dow, "long")} ${hourSpan(hour)}: ${value(v)}`}
				onMouseEnter={point(dow, hour)}
				onFocus={point(dow, hour)}
				onClick={point(dow, hour)}
				className={cn(
					"h-6 min-w-0 rounded-[5px] outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring",
					heatOf(metric, v[metric], max),
					selected && "scale-110 ring-2 ring-foreground/70"
				)}
			/>
		);
	};

	const label = active ? (
		<div
			className="-translate-x-1/2 -translate-y-full pointer-events-none absolute z-10 whitespace-nowrap rounded-lg bg-popover px-3 py-2 text-popover-foreground text-xs shadow-lg ring-1 ring-border"
			style={{ left: active.x, top: active.y - 6 }}
			role="status"
		>
			<p className="font-medium">
				{dayName(active.dow, "long")} {hourSpan(active.hour)}
			</p>
			<p className="mt-0.5 text-muted-foreground">
				{t("average")} <span className="numeric font-semibold text-foreground">{value(cellAt(active.dow, active.hour))}</span>
			</p>
		</div>
	) : null;

	return (
		<div className="grid gap-4">
			<Surface className="min-w-0">
				<SectionTitle
					action={
						<Segmented
							size="sm"
							value={view}
							onChange={chooseView}
							options={[
								{
									value: "chart",
									label: (
										<span className="flex items-center gap-1.5">
											<BarChart3 className="size-3.5" />
											{t("viewChart")}
										</span>
									),
								},
								{
									value: "grid",
									label: (
										<span className="flex items-center gap-1.5">
											<Grid3x3 className="size-3.5" />
											{t("viewGrid")}
										</span>
									),
								},
							]}
						/>
					}
				>
					{t("heatmapTitle")}
				</SectionTitle>

				<div className="-mt-1 mb-5 flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between">
					<p className="text-muted-foreground text-xs leading-relaxed">
						{view === "chart" ? t("chartHint") : t("heatmapHint")}
					</p>
					<Segmented
						size="sm"
						className="shrink-0 self-start"
						value={metric}
						onChange={setMetric}
						options={[
							{ value: "orders", label: t("metricOrders") },
							{ value: "revenue", label: t("metricRevenue") },
						]}
					/>
				</div>

				{view === "chart" ? (
					<>
						<Segmented
							variant="chips"
							size="sm"
							value={day}
							onChange={setDay}
							options={[
								{ value: "all" as Day, label: t("allDays") },
								...DAYS.map((dow) => ({ value: `${dow}` as Day, label: dayName(dow) })),
							]}
						/>
						<p className="mt-4 mb-2 min-h-5 text-sm">
							{best ? (
								<>
									<span className="text-muted-foreground">{t("bestHour")} </span>
									<span className="font-semibold">{hourSpan(best.hour)}</span>
									<span className="text-muted-foreground"> · {t("average")} </span>
									<span className="numeric font-semibold">{value(best)}</span>
								</>
							) : (
								<span className="text-muted-foreground">{t("noSalesDay")}</span>
							)}
						</p>
						<div className="-ml-2 h-[260px]">
							<ResponsiveContainer width="100%" height="100%">
								<BarChart data={hourly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
									<CartesianGrid vertical={false} stroke="var(--border)" />
									<XAxis
										dataKey="label"
										tickLine={false}
										axisLine={false}
										interval="preserveStartEnd"
										minTickGap={8}
										tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
									/>
									<YAxis
										tickLine={false}
										axisLine={false}
										width={metric === "revenue" ? 52 : 36}
										allowDecimals={metric === "revenue"}
										tickFormatter={(v: number) => (metric === "revenue" ? axisBaht(v) : formatNumber(v))}
										tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
									/>
									<Tooltip
										cursor={{ fill: "var(--muted)", opacity: 0.6 }}
										content={(props) => {
											const point = props.active ? (props.payload?.[0]?.payload as (typeof hourly)[number] | undefined) : undefined;
											if (!point) return null;
											return (
												<div className="rounded-xl bg-popover px-3 py-2 text-popover-foreground text-xs shadow-lg ring-1 ring-border">
													<p className="font-medium">
														{day === "all" ? t("allDays") : dayName(Number(day), "long")} {hourSpan(point.hour)}
													</p>
													<p className="mt-0.5 text-muted-foreground">
														{t("average")} <span className="numeric font-semibold text-foreground">{value(point)}</span>
													</p>
												</div>
											);
										}}
									/>
									<Bar dataKey={metric} radius={[4, 4, 0, 0]} maxBarSize={28} animationDuration={400}>
										{hourly.map((h) => (
											<Cell
												key={h.hour}
												fill={COLOR[metric]}
												// The busiest hour at full strength; the rest recede so it stands out.
												fillOpacity={best && h.hour === best.hour ? 1 : 0.4}
											/>
										))}
									</Bar>
								</BarChart>
							</ResponsiveContainer>
						</div>
					</>
				) : (
					<>
				{/* Wide: days down, hours across. */}
				<div data-grid className="relative hidden tablet:block" onMouseLeave={() => setActive(null)}>
					<div className="grid gap-1.5" style={{ gridTemplateColumns: `2.5rem repeat(${hours.length}, minmax(0, 1fr))` }}>
						<span />
						{hours.map((h) => (
							<span key={h} className="numeric text-center text-[11px] text-muted-foreground">
								{String(h).padStart(2, "0")}
							</span>
						))}
						{DAYS.map((dow) => (
							<div key={dow} className="contents">
								<span className="self-center text-muted-foreground text-xs">{dayName(dow)}</span>
								{hours.map((h) => cell(dow, h))}
							</div>
						))}
					</div>
					{label}
				</div>

				{/* Phone: the seven days across, the hours down. */}
				<div data-grid className="relative tablet:hidden">
					<div className="grid gap-1.5" style={{ gridTemplateColumns: "2.75rem repeat(7, minmax(0, 1fr))" }}>
						<span />
						{DAYS.map((dow) => (
							<span key={dow} className="text-center text-muted-foreground text-xs">
								{dayName(dow)}
							</span>
						))}
						{hours.map((h) => (
							<div key={h} className="contents">
								<span className="numeric self-center text-[11px] text-muted-foreground">{String(h).padStart(2, "0")}:00</span>
								{DAYS.map((dow) => cell(dow, h))}
							</div>
						))}
					</div>
					{label}
				</div>

				<div className="mt-5 flex items-center gap-2 text-muted-foreground text-xs">
					<span>{t("less")}</span>
					<span className="flex gap-1" aria-hidden>
						{[EMPTY, ...RAMP[metric]].map((bg) => (
							<span key={bg} className={cn("size-3 rounded-[3px]", bg)} />
						))}
					</span>
					<span>{t("more")}</span>
				</div>
					</>
				)}
			</Surface>

			<div className="grid items-start gap-4 desktop:grid-cols-2">
				<Surface>
					<SectionTitle>{t("topSlots")}</SectionTitle>
					<ol className="grid gap-1">
						{top.map((slot, i) => (
							<li key={`${slot.dow}-${slot.hour}`} className="flex items-center gap-4 rounded-xl px-1 py-2.5">
								<span className="numeric flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted font-semibold text-muted-foreground text-sm">
									{i + 1}
								</span>
								<span className="min-w-0 flex-1">
									<span className="block font-medium text-sm">{dayName(slot.dow, "long")}</span>
									<span className="numeric block text-muted-foreground text-xs">{hourSpan(slot.hour)}</span>
								</span>
								{figure(slot)}
							</li>
						))}
					</ol>
				</Surface>
				<Surface>
					<SectionTitle>{t("byWeekday")}</SectionTitle>
					<ul className="grid gap-3.5">
						{byDay.map((d) => (
							// Fixed columns so every bar starts and ends at the same place.
							<li key={d.dow} className="grid grid-cols-[4.75rem_1fr_5.25rem] items-center gap-3 text-sm tablet:grid-cols-[5.5rem_1fr_6.5rem] tablet:gap-4">
								<span className="text-muted-foreground">{dayName(d.dow, "long")}</span>
								<span className="h-2 overflow-hidden rounded-full bg-muted">
									<span
										className={cn("block h-full rounded-full", BAR[metric])}
										style={{ width: `${dayMax ? (d[metric] / dayMax) * 100 : 0}%` }}
									/>
								</span>
								{figure(d)}
							</li>
						))}
					</ul>
					<p className="mt-5 text-muted-foreground text-xs leading-relaxed">{t("perDayHint")}</p>
				</Surface>
			</div>
		</div>
	);
}

type ProfitSort = "revenue" | "profit" | "margin";

/**
 * Profit by category and by product, from the cost recorded on each sold line. Revenue is after
 * each line's share of the order discount, so the totals match the Sales tab's gross profit
 * (orders from before shares were recorded still count their discount as 0).
 */
export function ProfitInsights({ data }: { data: InsightsDto }) {
	const t = useTranslations("reports.insights");
	const tr = useTranslations("reports");
	const [sort, setSort] = useState<ProfitSort>("revenue");

	const totals = data.categories.reduce(
		(s, c) => ({ revenue: s.revenue + c.revenue, cost: s.cost + c.cost, profit: s.profit + c.profit }),
		{ revenue: 0, cost: 0, profit: 0 }
	);
	const margin = (row: { revenue: number; profit: number }) => percent(row.profit, row.revenue);
	const products = useMemo(
		() =>
			[...data.products].sort((a, b) =>
				sort === "margin" ? (margin(b) ?? -Infinity) - (margin(a) ?? -Infinity) : b[sort] - a[sort]
			),
		[data.products, sort]
	);

	if (data.products.length === 0) {
		return (
			<Surface>
				<EmptyState icon={Coins} title={tr("empty")} />
			</Surface>
		);
	}

	const marginCell = (row: { revenue: number; profit: number; cost: number }) => {
		const m = margin(row);
		return (
			<span className={cn("numeric", m !== null && m < 0 && "text-danger")}>{m === null ? "–" : `${m}%`}</span>
		);
	};
	const noCost = t("noCost");

	type Category = InsightsDto["categories"][number];
	const categoryColumns: Column<Category>[] = [
		{ key: "name", header: t("category"), cell: (c) => <span className="font-medium">{c.name ?? t("uncategorized")}</span> },
		{ key: "sold", header: tr("csvSold"), align: "right", hideBelow: "tablet", cell: (c) => <span className="numeric">{formatNumber(c.sold)}</span> },
		{ key: "revenue", header: tr("revenue"), align: "right", cell: (c) => <span className="numeric">{formatBaht(c.revenue)}</span> },
		{ key: "profit", header: t("profit"), align: "right", cell: (c) => <span className="numeric font-medium">{formatBaht(c.profit)}</span> },
		{ key: "margin", header: t("margin"), align: "right", cell: marginCell },
	];

	type Product = InsightsDto["products"][number];
	const productColumns: Column<Product>[] = [
		{
			key: "name",
			header: t("product"),
			cell: (p) => (
				<span className="flex min-w-0 items-center gap-2.5">
					<ProductThumb art={p.art} name={p.name} className="size-8" rounded="rounded-md" />
					<span className="min-w-0">
						<span className="block truncate font-medium">{p.name}</span>
						<span className="block truncate text-muted-foreground text-xs">{p.category ?? t("uncategorized")}</span>
					</span>
					{p.missingCost ? (
						<StatusBadge tone="warning" className="shrink-0">
							{noCost}
						</StatusBadge>
					) : null}
				</span>
			),
		},
		{ key: "sold", header: tr("csvSold"), align: "right", hideBelow: "tablet", cell: (p) => <span className="numeric">{formatNumber(p.sold)}</span> },
		{ key: "revenue", header: tr("revenue"), align: "right", cell: (p) => <span className="numeric">{formatBaht(p.revenue)}</span> },
		{ key: "cost", header: t("cost"), align: "right", hideBelow: "desktop", cell: (p) => <span className="numeric text-muted-foreground">{formatBaht(p.cost)}</span> },
		{ key: "profit", header: t("profit"), align: "right", cell: (p) => <span className="numeric font-medium">{formatBaht(p.profit)}</span> },
		{ key: "margin", header: t("margin"), align: "right", cell: marginCell },
	];

	const productRow = (p: Product) => (
		<div className="flex items-center gap-3 text-sm">
			<ProductThumb art={p.art} name={p.name} className="size-9" rounded="rounded-lg" />
			<div className="min-w-0 flex-1">
				<p className="truncate font-medium">{p.name}</p>
				<p className="text-muted-foreground text-xs">
					{tr("sold", { count: p.sold })} · {formatBaht(p.revenue)}
					{p.missingCost ? <span className="text-amber-700 dark:text-warning"> · {noCost}</span> : null}
				</p>
			</div>
			<div className="text-right">
				<p className="numeric font-semibold">{formatBaht(p.profit)}</p>
				<p className="text-xs">{marginCell(p)}</p>
			</div>
		</div>
	);

	return (
		<>
			<div className="grid grid-cols-2 gap-3 desktop:grid-cols-4">
				<MetricCard icon={Coins} tone="success" label={t("linesRevenue")} value={formatBaht(totals.revenue)} />
				<MetricCard icon={Wallet} tone="danger" label={t("cost")} value={formatBaht(totals.cost)} />
				<MetricCard icon={PiggyBank} tone="warning" label={t("profit")} value={formatBaht(totals.profit)} />
				<MetricCard icon={Percent} tone="info" label={t("margin")} value={`${margin(totals) ?? 0}%`} />
			</div>
			<p className="text-muted-foreground text-xs leading-relaxed">{t("profitHint")}</p>

			<Surface className="p-0">
				<div className="px-5 pt-5">
					<SectionTitle>{t("byCategory")}</SectionTitle>
				</div>
				<DataTable columns={categoryColumns} rows={data.categories} rowKey={(c) => c.id ?? "none"} />
			</Surface>

			<Surface className="p-0">
				<div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
					<SectionTitle className="mb-0">{t("byProduct")}</SectionTitle>
					<Segmented
						size="sm"
						value={sort}
						onChange={setSort}
						options={[
							{ value: "revenue", label: t("sortRevenue") },
							{ value: "profit", label: t("sortProfit") },
							{ value: "margin", label: t("sortMargin") },
						]}
					/>
				</div>
				<div className="mt-3">
					<DataTable
						columns={productColumns}
						rows={products}
						rowKey={(p) => `${p.productId ?? "gone"}-${p.name}`}
						mobileRow={productRow}
					/>
				</div>
			</Surface>
		</>
	);
}

const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

/**
 * Who buys: how many customers the window saw, how many were new, and who they are — the
 * best customers of the period and the regulars who have stopped coming. Only orders linked
 * to a customer at the till count, so the share of sales that was linked is shown first.
 */
export function CustomerInsights({ data }: { data: InsightsDto }) {
	const t = useTranslations("reports.insights");
	const tr = useTranslations("reports");
	const router = useRouter();
	const c = data.customers;
	const linked = percent(c.identifiedRevenue, c.revenue);
	const openOrders = (row: InsightsCustomerRow) =>
		router.push(`/orders?customer=${row.id}&customerName=${encodeURIComponent(row.name)}`);

	const nameCell = (row: InsightsCustomerRow) => (
		<span className="min-w-0">
			<span className="block truncate font-medium">{row.name}</span>
			{row.phone ? <span className="numeric block text-muted-foreground text-xs">{row.phone}</span> : null}
		</span>
	);
	const lastCell = (row: InsightsCustomerRow) => (
		<span className="text-muted-foreground">{t("daysAgo", { count: daysSince(row.lastOrderAt) })}</span>
	);
	const columns: Column<InsightsCustomerRow>[] = [
		{ key: "name", header: t("customer"), cell: nameCell },
		{ key: "orders", header: tr("orders"), align: "right", cell: (r) => <span className="numeric">{formatNumber(r.orders)}</span> },
		{ key: "revenue", header: tr("revenue"), align: "right", cell: (r) => <span className="numeric font-medium">{formatBaht(r.revenue)}</span> },
		{ key: "last", header: t("lastOrder"), align: "right", hideBelow: "tablet", cell: lastCell },
	];
	const mobileRow = (row: InsightsCustomerRow) => (
		<div className="flex items-center gap-3 text-sm">
			<div className="min-w-0 flex-1">{nameCell(row)}</div>
			<div className="text-right">
				<p className="numeric font-semibold">{formatBaht(row.revenue)}</p>
				<p className="text-muted-foreground text-xs">
					{t("ordersCount", { count: row.orders })} · {t("daysAgo", { count: daysSince(row.lastOrderAt) })}
				</p>
			</div>
		</div>
	);

	return (
		<>
			<div className="grid grid-cols-2 gap-3 desktop:grid-cols-4">
				<MetricCard icon={Users} tone="primary" label={t("customers")} value={formatNumber(c.customers)} />
				<MetricCard icon={UserPlus} tone="success" label={t("newCustomers")} value={formatNumber(c.newCustomers)} />
				<MetricCard icon={Repeat} tone="info" label={t("returning")} value={formatNumber(c.returningCustomers)} />
				<MetricCard
					icon={UserSearch}
					tone="warning"
					label={t("linkedShare")}
					value={linked === null ? "–" : `${linked}%`}
					note={t("linkedOrders", { count: c.identifiedOrders, total: c.orders })}
				/>
			</div>
			{linked !== null && linked < 50 ? (
				<p className="text-muted-foreground text-xs leading-relaxed">{t("linkHint")}</p>
			) : null}

			{c.customers === 0 ? (
				<Surface>
					<EmptyState icon={Users} title={t("noCustomers")} description={t("linkHint")} />
				</Surface>
			) : (
				<div className="grid gap-4 desktop:grid-cols-2">
					<Surface className="p-0">
						<div className="px-5 pt-5">
							<SectionTitle>{t("topCustomers")}</SectionTitle>
						</div>
						<DataTable columns={columns} rows={c.top} rowKey={(r) => r.id} onRowClick={openOrders} mobileRow={mobileRow} />
					</Surface>
					<Surface className="p-0">
						<div className="px-5 pt-5">
							<SectionTitle className="mb-1">{t("lapsed")}</SectionTitle>
							<p className="mb-3 text-muted-foreground text-xs">{t("lapsedHint")}</p>
						</div>
						{c.lapsed.length === 0 ? (
							<p className="px-5 pb-5 text-muted-foreground text-sm">{t("noLapsed")}</p>
						) : (
							<DataTable columns={columns} rows={c.lapsed} rowKey={(r) => r.id} onRowClick={openOrders} mobileRow={mobileRow} />
						)}
					</Surface>
				</div>
			)}
		</>
	);
}
