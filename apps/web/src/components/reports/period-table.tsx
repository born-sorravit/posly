"use client";

import { Segmented } from "@/components/common/controls";
import { SectionTitle, StatusBadge, Surface } from "@/components/common/primitives";
import { trimHours } from "@/components/dashboard/sales-chart";
import type { DashboardDto, ReportRange } from "@/lib/api/posly";
import { formatNumber, formatThaiDate } from "@posly/utils/format";
import { formatBaht } from "@posly/utils/money";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

type Bucket = DashboardDto["series"][number];
type Grain = "hour" | "day" | "week";

interface Row {
	key: string;
	label: string;
	sublabel: string | null;
	orders: number;
	revenue: number;
}

const dateOf = (iso: string) => new Date(`${iso}T12:00:00+07:00`);

/** "จ. 22 ก.ย." — a day a shop owner recognises, not an ISO string. */
const dayLabel = (iso: string) => formatThaiDate(dateOf(iso), { weekday: "short", day: "numeric", month: "short" });

/** Monday-start weeks, like every Thai wall calendar. */
const weekStart = (iso: string) => {
	const d = dateOf(iso);
	const shift = (d.getUTCDay() + 6) % 7;
	return new Date(d.getTime() - shift * 86_400_000).toISOString().slice(0, 10);
};

interface Labels {
	thisWeek: string;
	/** Only a week ending today is "so far"; a custom range can end mid-week in the past. */
	today: string;
	days: (n: number) => string;
}

const toRows = (series: Bucket[], grain: Grain, range: ReportRange, labels: Labels): Row[] => {
	if (grain === "hour") {
		return trimHours(series, range).map((b) => {
			const next = String((Number(b.label) + 1) % 24).padStart(2, "0");
			return { key: `${b.date}-${b.label}`, label: `${b.label}:00 – ${next}:00`, sublabel: null, orders: b.orders, revenue: b.revenue };
		});
	}
	if (grain === "day") {
		return [...series].reverse().map((b) => ({
			key: b.date,
			label: dayLabel(b.date),
			sublabel: null,
			orders: b.orders,
			revenue: b.revenue,
		}));
	}
	const weeks = new Map<string, Row & { first: string; last: string }>();
	for (const b of series) {
		const start = weekStart(b.date);
		const row = weeks.get(start) ?? { key: start, label: "", sublabel: null, orders: 0, revenue: 0, first: b.date, last: b.date };
		row.orders += b.orders;
		row.revenue += b.revenue;
		row.last = b.date;
		weeks.set(start, row);
	}
	const short = (iso: string) => formatThaiDate(dateOf(iso), { day: "numeric", month: "short" });
	const values = [...weeks.values()].reverse();
	return values.map((w, i) => {
		const days = Math.round((dateOf(w.last).getTime() - dateOf(w.first).getTime()) / 86_400_000) + 1;
		// The newest week is still running; the oldest may start mid-week at the edge of the range.
		const partial = days < 7 ? (i === 0 && w.last === labels.today ? labels.thisWeek : labels.days(days)) : null;
		return {
			key: w.key,
			label: w.first === w.last ? dayLabel(w.first) : `${short(w.first)} – ${short(w.last)}`,
			sublabel: partial,
			orders: w.orders,
			revenue: w.revenue,
		};
	});
};

/**
 * The breakdown under the sales chart. Its grain follows the range — hours for a single day,
 * days for a week, days or weeks for a month — and every row shows its share of the best
 * period as a bar, so the busy hours and slow days stand out without reading numbers.
 */
export function PeriodTable({ series, range }: { series: Bucket[]; range: ReportRange }) {
	const t = useTranslations("reports");
	const single = range === "today" || range === "yesterday";
	const [monthGrain, setMonthGrain] = useState<"day" | "week">("day");
	const grain: Grain = single ? "hour" : range === "30d" ? monthGrain : "day";

	const rows = useMemo(
		() =>
			toRows(series, grain, range, {
				thisWeek: t("thisWeekSoFar"),
				today: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date()),
				days: (n) => t("partialDays", { count: n }),
			}),
		[series, grain, range, t]
	);
	const best = Math.max(1, ...rows.map((r) => r.revenue));
	const bestKey = rows.find((r) => r.revenue === best && r.revenue > 0)?.key;
	const total = rows.reduce((s, r) => ({ orders: s.orders + r.orders, revenue: s.revenue + r.revenue }), { orders: 0, revenue: 0 });

	const title = grain === "hour" ? t("hourly") : grain === "week" ? t("weekly") : t("daily");
	const periodHeader = grain === "hour" ? t("time") : grain === "week" ? t("week") : t("date");

	return (
		<Surface className="p-0">
			<div className="flex items-center justify-between gap-3 px-5 pt-5">
				<SectionTitle className="mb-0">{title}</SectionTitle>
				{range === "30d" ? (
					<Segmented
						size="sm"
						value={monthGrain}
						onChange={setMonthGrain}
						options={[
							{ value: "day", label: t("byDay") },
							{ value: "week", label: t("byWeek") },
						]}
					/>
				) : null}
			</div>

			<div className="mt-3 overflow-x-auto">
				<table className="w-full border-separate border-spacing-0 text-sm">
					<thead>
						<tr className="text-left text-muted-foreground text-xs [&>th]:h-10 [&>th]:border-border [&>th]:border-b [&>th]:font-medium">
							<th className="pl-5">{periodHeader}</th>
							<th className="px-3 text-right">{t("orders")}</th>
							<th className="px-3 text-right">{t("revenue")}</th>
							<th className="hidden px-3 text-right tablet:table-cell">{t("average")}</th>
							<th className="hidden w-[28%] pr-5 pl-3 desktop:table-cell">{t("share")}</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => {
							const empty = row.orders === 0;
							return (
								<tr key={row.key} className={cn("transition-colors hover:bg-muted/40", empty && "text-muted-foreground")}>
									<td className="h-12 border-border/50 border-b pl-5">
										<span className="flex items-center gap-2">
											<span className="numeric font-medium">{row.label}</span>
											{row.sublabel ? <span className="text-muted-foreground text-xs">{row.sublabel}</span> : null}
											{row.key === bestKey ? <StatusBadge tone="success">{t("best")}</StatusBadge> : null}
										</span>
									</td>
									<td className="numeric h-12 border-border/50 border-b px-3 text-right">{formatNumber(row.orders)}</td>
									<td className="numeric h-12 border-border/50 border-b px-3 text-right font-medium">{formatBaht(row.revenue)}</td>
									<td className="numeric hidden h-12 border-border/50 border-b px-3 text-right tablet:table-cell">
										{empty ? "—" : formatBaht(Math.round(row.revenue / row.orders))}
									</td>
									<td className="hidden h-12 border-border/50 border-b pr-5 pl-3 desktop:table-cell">
										<span className="block h-2 overflow-hidden rounded-full bg-muted">
											<span
												className={cn("block h-full rounded-full", row.key === bestKey ? "bg-success" : "bg-chart-1")}
												style={{ width: `${(row.revenue / best) * 100}%` }}
											/>
										</span>
									</td>
								</tr>
							);
						})}
					</tbody>
					<tfoot>
						<tr className="font-semibold">
							<td className="h-12 pl-5">{t("total")}</td>
							<td className="numeric h-12 px-3 text-right">{formatNumber(total.orders)}</td>
							<td className="numeric h-12 px-3 text-right">{formatBaht(total.revenue)}</td>
							<td className="numeric hidden h-12 px-3 text-right tablet:table-cell">
								{total.orders ? formatBaht(Math.round(total.revenue / total.orders)) : "—"}
							</td>
							<td className="hidden desktop:table-cell" />
						</tr>
					</tfoot>
				</table>
			</div>
		</Surface>
	);
}
