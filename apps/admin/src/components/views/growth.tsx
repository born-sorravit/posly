"use client";

import { CountUp } from "@/components/motion/count-up";
import { Stagger } from "@/components/motion/reveal";
import { MEASURE_COLOR } from "@/lib/chart-colors";
import { DailyChart } from "@/components/charts/daily-chart";
import { DemoToggle, useDemoFilter } from "@/components/common/demo-filter";
import { ErrorState, PageHeader, SectionTitle, StatCard, Surface } from "@/components/common/primitives";
import { useAdmin } from "@/lib/admin-api";
import type { AdminGrowthResponse } from "@/lib/types";
import { Skeleton } from "@posly/ui/components/skeleton";
import { formatNumber, formatThaiDate } from "@posly/utils/format";
import { formatBaht } from "@posly/utils/money";
import { Coins, Store, TrendingUp, Users } from "lucide-react";

const monthLabel = (month: string) => formatThaiDate(`${month}-01T12:00:00+07:00`, { month: "short", year: "2-digit" });

/** Change of the last full month over the one before, as a signed percentage. */
const change = (current: number, previous: number) =>
	previous === 0 ? null : Math.round(((current - previous) / previous) * 1000) / 10;

/**
 * Retention by signup month: of the shops that signed up in a month, the share that sold
 * anything in each month after. Tinted by that share, one hue (magnitude, not identity).
 */
function CohortTable({ cohorts }: { cohorts: AdminGrowthResponse["cohorts"] }) {
	const width = Math.max(1, ...cohorts.map((c) => c.active.length));
	if (!cohorts.length) return <p className="px-5 pb-5 text-muted-foreground text-sm">ยังไม่มีร้านที่สมัครใน 6 เดือนนี้</p>;
	return (
		<div className="overflow-x-auto px-5 pb-5">
			<table className="w-full min-w-[520px] border-separate border-spacing-1 text-sm">
				<thead>
					<tr className="text-muted-foreground text-xs">
						<th className="px-2 py-1 text-left font-medium">เดือนที่สมัคร</th>
						<th className="px-2 py-1 text-right font-medium">ร้าน</th>
						{Array.from({ length: width }, (_, k) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: month offsets are the key
							<th key={k} className="px-2 py-1 text-center font-medium">
								{k === 0 ? "เดือนแรก" : `+${k}`}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{cohorts.map((cohort) => (
						<tr key={cohort.month}>
							<td className="whitespace-nowrap px-2 py-1.5">{monthLabel(cohort.month)}</td>
							<td className="numeric px-2 py-1.5 text-right">{formatNumber(cohort.size)}</td>
							{Array.from({ length: width }, (_, k) => {
								const active = cohort.active[k];
								if (active === undefined) {
									// biome-ignore lint/suspicious/noArrayIndexKey: month offsets are the key
									return <td key={k} />;
								}
								const share = cohort.size ? active / cohort.size : 0;
								return (
									<td
										// biome-ignore lint/suspicious/noArrayIndexKey: month offsets are the key
										key={k}
										title={`${formatNumber(active)} จาก ${formatNumber(cohort.size)} ร้าน`}
										className="numeric rounded-lg px-2 py-1.5 text-center font-medium"
										style={{ backgroundColor: `color-mix(in oklab, var(--primary) ${Math.round(share * 45)}%, var(--muted))` }}
									>
										{Math.round(share * 100)}%
									</td>
								);
							})}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

export function GrowthView() {
	const { includeDemo } = useDemoFilter();
	const { data, error, isLoading, refetch } = useAdmin<AdminGrowthResponse>("growth", { includeDemo }, 5 * 60_000);
	const months = data?.months.map((m) => ({ ...m, date: `${m.month}-01` }));
	// The last full month against the one before it: the current month is still running.
	const last = data?.months.at(-2);
	const before = data?.months.at(-3);
	const daily = data?.daily.map((d) => ({ ...d, date: d.day }));

	return (
		<div className="grid gap-6">
			<PageHeader title="การเติบโต" description="ร้าน ผู้ใช้ และรายได้ย้อนหลัง 12 เดือน" actions={<DemoToggle />} />

			{error && !data ? (
				<Surface>
					<ErrorState error={error} retry={() => refetch()} />
				</Surface>
			) : (
				<>
					<Stagger trigger="mount" className="grid grid-cols-2 gap-3 desktop:grid-cols-4 desktop:gap-4">
						<StatCard
							tinted
							tone="success"
							icon={Coins}
							label="MRR ตอนนี้"
							loading={isLoading}
							value={data ? <CountUp value={data.now.mrr} format={formatBaht} /> : null}
							hint={data ? `${formatNumber(data.now.paidBusinesses)} ร้านที่จ่ายเงิน` : null}
							trend={data?.daily.map((d) => d.mrr)}
						/>
						<StatCard
							tinted
							tone="primary"
							icon={Store}
							label={last ? `ร้าน active ${monthLabel(last.month)}` : "ร้าน active"}
							loading={isLoading}
							value={last ? <CountUp value={last.activeBusinesses} format={formatNumber} /> : null}
							hint={
								last && before && change(last.activeBusinesses, before.activeBusinesses) !== null
									? `${change(last.activeBusinesses, before.activeBusinesses)}% จากเดือนก่อน`
									: "มีออเดอร์ที่ชำระแล้วในเดือนนั้น"
							}
							trend={data?.months.map((m) => m.activeBusinesses)}
						/>
						<StatCard
							tinted
							tone="info"
							icon={TrendingUp}
							label={last ? `ร้านใหม่ ${monthLabel(last.month)}` : "ร้านใหม่"}
							loading={isLoading}
							value={last ? <CountUp value={last.newBusinesses} format={formatNumber} /> : null}
							trend={data?.months.map((m) => m.newBusinesses)}
						/>
						<StatCard
							tinted
							tone="warning"
							icon={Users}
							label={last ? `ผู้ใช้ใหม่ ${monthLabel(last.month)}` : "ผู้ใช้ใหม่"}
							loading={isLoading}
							value={last ? <CountUp value={last.signups} format={formatNumber} /> : null}
							trend={data?.months.map((m) => m.signups)}
						/>
					</Stagger>

					<Surface>
						<SectionTitle
							title="MRR รายวัน"
							hint="ระบบเก็บ snapshot วันละครั้ง ไม่มีข้อมูลก่อนวันที่เริ่มเก็บ (ไม่รวมร้าน demo)"
						/>
						<div className="px-3 pb-4">
							{daily ? (
								daily.length > 1 ? (
									<DailyChart data={daily} dataKey="mrr" kind="money" label="MRR" color={MEASURE_COLOR.mrr} />
								) : (
									<p className="px-2 pb-2 text-muted-foreground text-sm">
										เริ่มเก็บเมื่อ {daily[0] ? formatThaiDate(`${daily[0].day}T12:00:00+07:00`) : "วันนี้"} กราฟจะขึ้นเมื่อมีข้อมูลตั้งแต่ 2 วัน
									</p>
								)
							) : (
								<Skeleton className="mx-2 h-[240px]" />
							)}
						</div>
					</Surface>

					<div className="grid gap-4 desktop:grid-cols-2">
						<Surface>
							<SectionTitle title="ร้าน active รายเดือน" hint="ร้านที่มีออเดอร์ที่ชำระแล้วอย่างน้อย 1 ใบในเดือนนั้น" />
							<div className="px-3 pb-4">
								{months ? (
									<DailyChart data={months} dataKey="activeBusinesses" kind="count" label="ร้าน active" granularity="month" color={MEASURE_COLOR.activeBusinesses} />
								) : (
									<Skeleton className="mx-2 h-[240px]" />
								)}
							</div>
						</Surface>
						<Surface>
							<SectionTitle title="ยอดขายรายเดือน" hint="ยอดขายรวมทุกร้าน" />
							<div className="px-3 pb-4">
								{months ? (
									<DailyChart data={months} dataKey="gmv" kind="money" label="ยอดขาย" granularity="month" color={MEASURE_COLOR.gmv} />
								) : (
									<Skeleton className="mx-2 h-[240px]" />
								)}
							</div>
						</Surface>
						<Surface>
							<SectionTitle title="ร้านใหม่รายเดือน" />
							<div className="px-3 pb-4">
								{months ? (
									<DailyChart data={months} dataKey="newBusinesses" kind="count" label="ร้านใหม่" granularity="month" color={MEASURE_COLOR.newBusinesses} />
								) : (
									<Skeleton className="mx-2 h-[240px]" />
								)}
							</div>
						</Surface>
						<Surface>
							<SectionTitle title="ผู้ใช้ใหม่รายเดือน" />
							<div className="px-3 pb-4">
								{months ? (
									<DailyChart data={months} dataKey="signups" kind="count" label="ผู้ใช้ใหม่" granularity="month" color={MEASURE_COLOR.signups} />
								) : (
									<Skeleton className="mx-2 h-[240px]" />
								)}
							</div>
						</Surface>
					</div>

					<Surface>
						<SectionTitle
							title="Retention ตามเดือนที่สมัคร"
							hint="ของร้านที่สมัครในเดือนนั้น มีกี่ % ที่ยังมียอดขายในแต่ละเดือนต่อมา"
						/>
						{data ? <CohortTable cohorts={data.cohorts} /> : <Skeleton className="mx-5 mb-5 h-40" />}
					</Surface>
				</>
			)}
		</div>
	);
}
