"use client";

import { type Column, DataTable, Segmented } from "@/components/common/controls";
import { EmptyState, MetricCard, SectionTitle, StatusBadge, Surface } from "@/components/common/primitives";
import { ProductThumb } from "@/components/common/product-thumb";
import type { InsightsCustomerRow, InsightsDto } from "@/lib/api/posly";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { formatNumber, formatThaiDate } from "@posly/utils/format";
import { formatBaht } from "@posly/utils/money";
import { Coins, Percent, PiggyBank, Repeat, UserPlus, Users, UserSearch, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
/** Monday-first, like the heatmap rows. 2024-01-01 was a Monday. */
const dayName = (dow: number, weekday: "short" | "long" = "short") =>
	formatThaiDate(new Date(Date.UTC(2024, 0, dow, 5)), { weekday });
const hourSpan = (hour: number) => `${String(hour).padStart(2, "0")}:00–${String((hour + 1) % 24).padStart(2, "0")}:00`;

/** Five steps of one hue, empty cells in the muted surface — magnitude, not identity. */
const STEPS = [18, 36, 54, 72, 92];
const stepOf = (value: number, max: number) =>
	value <= 0 ? -1 : Math.min(STEPS.length - 1, Math.floor((value / max) * STEPS.length));
const stepColor = (step: number) =>
	step < 0 ? "var(--muted)" : `color-mix(in oklab, var(--primary) ${STEPS[step]}%, var(--muted))`;

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);

type Metric = "orders" | "revenue";

/**
 * When the shop sells: weekday × hour, each cell the average for one such day (the total over
 * how many Mondays, Tuesdays… the window holds), so a range with five Mondays and four
 * Sundays does not favour Monday. Rows are days on a wide screen; on a phone the grid turns so
 * the seven days fit across and the hours run down.
 */
export function PeakHours({ data }: { data: InsightsDto }) {
	const t = useTranslations("reports.insights");
	const [metric, setMetric] = useState<Metric>("orders");
	const [active, setActive] = useState<{ dow: number; hour: number } | null>(null);

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
				count: weeks[dow - 1] ?? 0,
			};
		});
		return { grid, hours, max, top, byDay };
	}, [data, metric]);

	if (data.heatmap.cells.length === 0) {
		return (
			<Surface>
				<EmptyState icon={Users} title={t("empty")} />
			</Surface>
		);
	}

	const value = (v: { orders: number; revenue: number }) =>
		metric === "orders" ? t("avgOrders", { count: formatNumber(Math.round(v.orders * 10) / 10) }) : formatBaht(Math.round(v.revenue));
	const cellAt = (dow: number, hour: number) => grid.get(`${dow}-${hour}`) ?? { orders: 0, revenue: 0 };
	const readout = active ?? top[0];
	const dayMax = Math.max(1, ...byDay.map((d) => d[metric]));

	const cell = (dow: number, hour: number) => {
		const v = cellAt(dow, hour);
		const selected = active?.dow === dow && active.hour === hour;
		return (
			<button
				key={`${dow}-${hour}`}
				type="button"
				aria-label={`${dayName(dow, "long")} ${hourSpan(hour)}: ${value(v)}`}
				onMouseEnter={() => setActive({ dow, hour })}
				onFocus={() => setActive({ dow, hour })}
				onClick={() => setActive({ dow, hour })}
				className={cn(
					"h-7 min-w-0 rounded-[4px] outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring",
					selected && "ring-2 ring-foreground/70"
				)}
				style={{ backgroundColor: stepColor(stepOf(v[metric], max)) }}
			/>
		);
	};

	return (
		<div className="grid gap-4 desktop:grid-cols-[1fr_20rem]">
			<Surface className="min-w-0">
				<SectionTitle
					action={
						<Segmented
							size="sm"
							value={metric}
							onChange={setMetric}
							options={[
								{ value: "orders", label: t("metricOrders") },
								{ value: "revenue", label: t("metricRevenue") },
							]}
						/>
					}
				>
					{t("heatmapTitle")}
				</SectionTitle>
				<p className="-mt-2 mb-4 text-muted-foreground text-xs leading-relaxed">{t("heatmapHint")}</p>

				{/* The reading line: what the cell under the pointer (or the busiest one) holds. */}
				<p className="mb-3 min-h-5 text-sm" aria-live="polite">
					{readout ? (
						<>
							<span className="font-medium">
								{dayName(readout.dow, "long")} {hourSpan(readout.hour)}
							</span>
							<span className="text-muted-foreground"> · {t("average")} </span>
							<span className="numeric font-semibold">{value(cellAt(readout.dow, readout.hour))}</span>
						</>
					) : null}
				</p>

				{/* Wide: days down, hours across. */}
				<div className="hidden tablet:block" onMouseLeave={() => setActive(null)}>
					<div
						className="grid gap-[2px]"
						style={{ gridTemplateColumns: `2.5rem repeat(${hours.length}, minmax(0, 1fr))` }}
					>
						<span />
						{hours.map((h) => (
							<span key={h} className="numeric text-center text-[10px] text-muted-foreground">
								{h % 2 === hours[0] % 2 ? String(h).padStart(2, "0") : ""}
							</span>
						))}
						{DAYS.map((dow) => (
							<div key={dow} className="contents">
								<span className="self-center text-muted-foreground text-xs">{dayName(dow)}</span>
								{hours.map((h) => cell(dow, h))}
							</div>
						))}
					</div>
				</div>

				{/* Phone: the seven days across, the hours down. */}
				<div className="tablet:hidden">
					<div className="grid gap-[2px]" style={{ gridTemplateColumns: "3rem repeat(7, minmax(0, 1fr))" }}>
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
				</div>

				<div className="mt-4 flex items-center gap-2 text-muted-foreground text-xs">
					<span>{t("less")}</span>
					<span className="flex gap-[2px]" aria-hidden>
						{[-1, ...STEPS.keys()].map((s) => (
							<span key={s} className="size-3.5 rounded-[3px]" style={{ backgroundColor: stepColor(s) }} />
						))}
					</span>
					<span>{t("more")}</span>
				</div>
			</Surface>

			<div className="grid content-start gap-4">
				<Surface>
					<SectionTitle>{t("topSlots")}</SectionTitle>
					<ol className="grid gap-2.5">
						{top.map((slot, i) => (
							<li key={`${slot.dow}-${slot.hour}`} className="flex items-center gap-3 text-sm">
								<span className="numeric flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary text-xs">
									{i + 1}
								</span>
								<span className="flex-1 font-medium">
									{dayName(slot.dow, "long")} {hourSpan(slot.hour)}
								</span>
								<span className="numeric text-muted-foreground">{value(slot)}</span>
							</li>
						))}
					</ol>
				</Surface>
				<Surface>
					<SectionTitle>{t("byWeekday")}</SectionTitle>
					<ul className="grid gap-2.5">
						{byDay.map((d) => (
							<li key={d.dow} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 text-sm">
								<span>{dayName(d.dow, "long")}</span>
								<span className="h-2 overflow-hidden rounded-full bg-muted">
									<span
										className="block h-full rounded-full bg-primary"
										style={{ width: `${(d[metric] / dayMax) * 100}%` }}
									/>
								</span>
								<span className="numeric text-right font-medium">{value(d)}</span>
							</li>
						))}
					</ul>
					<p className="mt-3 text-muted-foreground text-xs">{t("perDayHint")}</p>
				</Surface>
			</div>
		</div>
	);
}

type ProfitSort = "revenue" | "profit" | "margin";

/**
 * Profit by category and by product, from the cost recorded on each sold line. Order-level
 * discounts are not spread over lines, so every figure here is before them — said on screen,
 * and the gap to the Sales tab's gross profit is exactly those discounts.
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
					{p.cost === 0 ? (
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
					{p.cost === 0 ? <span className="text-amber-700 dark:text-warning"> · {noCost}</span> : null}
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
