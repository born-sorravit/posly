"use client";

import { Segmented } from "@/components/common/controls";
import type { DashboardDto, ReportCompare, ReportQuery, ReportRange } from "@/lib/api/posly";
import { Link } from "@/i18n/navigation";
import { PeriodLineSkeleton } from "@/components/reports/reports-skeletons";
import { cn } from "@/lib/utils";
import { Input } from "@posly/ui/components/input";
import { formatThaiDate } from "@posly/utils/format";
import { CalendarRange, Lock } from "lucide-react";
import { useTranslations } from "next-intl";

/** The API's limit on a custom range, in days. */
export const MAX_CUSTOM_DAYS = 366;

export type PeriodMode = Exclude<ReportRange, "yesterday"> | "custom";

export interface Period {
	mode: PeriodMode;
	/** The last preset chosen: what is shown while a custom range is locked or unfinished. */
	preset: Exclude<ReportRange, "yesterday">;
	from: string;
	to: string;
	compare: ReportCompare;
}

const DAY = 86_400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const todayInShop = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
const addDays = (iso: string, n: number) => ymd(new Date(parse(iso).getTime() + n * DAY));
export const spanDays = (from: string, to: string) => Math.round((parse(to).getTime() - parse(from).getTime()) / DAY) + 1;

/** Ranges people ask for by name. Each ends today, or at the end of a finished month. */
const quickRanges = (today: string) => {
	const y = today.slice(0, 4);
	const monthStart = `${today.slice(0, 7)}-01`;
	const lastMonthEnd = addDays(monthStart, -1);
	return {
		thisMonth: { from: monthStart, to: today },
		lastMonth: { from: `${lastMonthEnd.slice(0, 7)}-01`, to: lastMonthEnd },
		last90: { from: addDays(today, -89), to: today },
		thisYear: { from: `${y}-01-01`, to: today },
	};
};

export const initialPeriod = (): Period => {
	const { thisMonth } = quickRanges(todayInShop());
	return { mode: "7d", preset: "7d", ...thisMonth, compare: "previous" };
};

/** A custom range the API will accept, or why not. */
export const customProblem = (p: Period): "order" | "tooLong" | null => {
	if (!p.from || !p.to) return "order";
	if (p.from > p.to) return "order";
	if (spanDays(p.from, p.to) > MAX_CUSTOM_DAYS) return "tooLong";
	return null;
};

/**
 * What to ask the API for. Without the Advanced report the page stays on presets against the
 * previous period, whatever is selected, so a locked choice never produces a 403.
 */
export const toQuery = (p: Period, advanced: boolean): ReportQuery => {
	if (!advanced) return { range: p.preset };
	if (p.mode === "custom" && !customProblem(p)) return { from: p.from, to: p.to, compare: p.compare };
	return { range: p.preset, compare: p.compare };
};

/**
 * The chart and the period table speak presets. A custom window borrows the nearest one: a
 * single day is hourly, up to a week reads as weekdays, anything longer as a month.
 */
export const displayRange = (data: Pick<DashboardDto, "range" | "days">): ReportRange => {
	if (data.range !== "custom") return data.range as ReportRange;
	return data.days <= 1 ? "yesterday" : data.days <= 7 ? "7d" : "30d";
};

const dateLabel = (d: Date) => formatThaiDate(d, { day: "numeric", month: "short", year: "numeric" });

/** "1 ก.ย. 2569 – 30 ก.ย. 2569", from the API's own window so it matches the figures exactly. */
export const windowLabel = (fromIso: string, days: number) => {
	const from = new Date(fromIso);
	const last = new Date(from.getTime() + (days - 1) * DAY);
	return days <= 1 ? dateLabel(from) : `${dateLabel(from)} – ${dateLabel(last)}`;
};

export function PeriodSummary({
	period,
	onChange,
	data,
	advanced,
}: {
	period: Period;
	onChange: (period: Period) => void;
	data: DashboardDto | undefined;
	advanced: boolean;
}) {
	const t = useTranslations("reports.period");
	const set = (patch: Partial<Period>) => onChange({ ...period, ...patch });
	const problem = period.mode === "custom" ? customProblem(period) : null;
	const today = todayInShop();
	const quick = quickRanges(today);
	const quickOptions = [
		{ key: "thisMonth", ...quick.thisMonth },
		{ key: "lastMonth", ...quick.lastMonth },
		{ key: "last90", ...quick.last90 },
		{ key: "thisYear", ...quick.thisYear },
	] as const;

	if (period.mode === "custom" && !advanced) {
		return (
			<div className="surface flex flex-col gap-3 rounded-2xl p-4 tablet:flex-row tablet:items-center">
				<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
					<Lock className="size-4" />
				</span>
				<p className="flex-1 text-sm">
					<span className="font-medium">{t("lockedTitle")}</span>{" "}
					<span className="text-muted-foreground">{t("lockedHint")}</span>
				</p>
				<Link href="/settings/subscription" className="font-medium text-primary text-sm hover:underline">
					{t("upgrade")}
				</Link>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			{period.mode === "custom" ? (
				<div className="surface flex flex-col gap-3 rounded-2xl p-4">
					<div className="flex flex-col gap-2 tablet:flex-row tablet:items-center">
						<div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 tablet:w-auto">
							<Input
								type="date"
								aria-label={t("from")}
								value={period.from}
								max={today}
								onChange={(e) => set({ from: e.target.value })}
								className="h-10 rounded-xl"
							/>
							<span className="text-muted-foreground">–</span>
							<Input
								type="date"
								aria-label={t("to")}
								value={period.to}
								min={period.from}
								max={today}
								onChange={(e) => set({ to: e.target.value })}
								className="h-10 rounded-xl"
							/>
						</div>
						<div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5 tablet:ml-2">
							{quickOptions.map((q) => {
								const selected = period.from === q.from && period.to === q.to;
								return (
									<button
										key={q.key}
										type="button"
										onClick={() => set({ from: q.from, to: q.to })}
										className={cn(
											"shrink-0 rounded-full border px-3 py-1.5 font-medium text-xs transition-colors",
											selected
												? "border-primary bg-primary/10 text-primary"
												: "border-border text-muted-foreground hover:bg-muted"
										)}
									>
										{t(`quick.${q.key}`)}
									</button>
								);
							})}
						</div>
					</div>
					{problem ? (
						<p className="text-danger text-xs">{problem === "order" ? t("invalidOrder") : t("tooLong", { count: MAX_CUSTOM_DAYS })}</p>
					) : null}
				</div>
			) : null}

			<div className="flex flex-col gap-2 tablet:flex-row tablet:items-center tablet:justify-between">
				{data ? (
					<p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
						<CalendarRange className="size-4 shrink-0 text-muted-foreground" aria-hidden />
						<span className="font-medium">{windowLabel(data.from, data.days)}</span>
						<span className="text-muted-foreground">
							{t("versus", { period: windowLabel(data.previousFrom, data.days) })}
						</span>
					</p>
				) : (
					<PeriodLineSkeleton />
				)}
				{advanced ? (
					<Segmented
						size="sm"
						value={period.compare}
						onChange={(compare) => set({ compare })}
						options={[
							{ value: "previous", label: t("comparePrevious") },
							{ value: "year", label: t("compareYear") },
						]}
					/>
				) : null}
			</div>
		</div>
	);
}
