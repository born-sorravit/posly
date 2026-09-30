"use client";

import { CountUp } from "@/components/motion/count-up";
import { Stagger } from "@/components/motion/reveal";
import { motion } from "motion/react";
import { DailyChart } from "@/components/charts/daily-chart";
import { DemoToggle, useDemoFilter } from "@/components/common/demo-filter";
import { EmptyState, ErrorState, SectionTitle, StatCard, Surface } from "@/components/common/primitives";
import { useAdmin } from "@/lib/admin-api";
import { PLAN_LABEL } from "@/lib/labels";
import { MEASURE_COLOR, PLAN_COLOR } from "@/lib/chart-colors";
import type { AdminOverviewResponse } from "@/lib/types";
import { Skeleton } from "@posly/ui/components/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@posly/ui/components/select";
import { formatNumber, formatThaiDate } from "@posly/utils/format";
import { formatBaht } from "@posly/utils/money";
import { Coins, ReceiptText, ShoppingBag, Store, TrendingUp, Undo2, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const RANGES = [7, 30, 90] as const;

/** Paying plans only: how many shops sit on each, as a horizontal bar per plan. */
function PlanBreakdown({ rows }: { rows: AdminOverviewResponse["subscriptions"] }) {
	const byPlan = new Map<string, number>();
	for (const row of rows) {
		if (row.status !== "ACTIVE" && row.status !== "TRIALING") continue;
		byPlan.set(row.plan, (byPlan.get(row.plan) ?? 0) + row.count);
	}
	const plans = ["FREE", "STARTER", "PRO", "BUSINESS"].map((plan) => ({ plan, count: byPlan.get(plan) ?? 0 }));
	const max = Math.max(1, ...plans.map((p) => p.count));
	return (
		<ul className="grid gap-3 px-5 pb-5">
			{plans.map(({ plan, count }) => (
				<li key={plan} className="grid gap-1.5">
					<div className="flex items-center justify-between text-sm">
						<span className="flex items-center gap-2">
							<span className="size-2.5 rounded-full" style={{ backgroundColor: PLAN_COLOR[plan] }} aria-hidden />
							{PLAN_LABEL[plan] ?? plan}
						</span>
						<span className="numeric font-medium">{formatNumber(count)}</span>
					</div>
					<div className="h-2 rounded-full bg-muted">
						<div
							className="h-2 rounded-full"
							style={{ width: `${(count / max) * 100}%`, minWidth: count ? 8 : 0, backgroundColor: PLAN_COLOR[plan] }}
						/>
					</div>
				</li>
			))}
		</ul>
	);
}

export function OverviewView() {
	const { includeDemo } = useDemoFilter();
	const [days, setDays] = useState<number>(30);
	const { data, error, isLoading, refetch } = useAdmin<AdminOverviewResponse>("overview", { days, includeDemo });
	const t = data?.totals;
	const series = data?.series;

	return (
		<div className="grid gap-6">
			{/* The same branded hero as the shop dashboard in apps/web: the one dark surface. */}
			<motion.section
				initial={{ opacity: 0, y: 6 }}
				animate={{ opacity: 1, y: 0 }}
				className="hero-surface relative overflow-hidden rounded-3xl px-6 py-7 text-white tablet:px-8 tablet:py-8"
			>
				<div aria-hidden className="hero-grid pointer-events-none absolute inset-0" />
				<div className="relative flex flex-col gap-4 tablet:flex-row tablet:items-start tablet:justify-between">
					<div className="space-y-1">
						<h1 className="font-semibold text-2xl tracking-tight tablet:text-3xl">ภาพรวมแพลตฟอร์ม</h1>
						<p className="text-white/70">ทุกร้านบน Posly · อัปเดตทุก 1 นาที</p>
					</div>
					<div className="flex flex-wrap items-center gap-3">
						<span className="text-sm text-white/60" suppressHydrationWarning>
							{formatThaiDate(new Date(), { day: "numeric", month: "long", year: "numeric" })}
						</span>
						<Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
							<SelectTrigger className="h-9 min-w-28 rounded-xl border-white/15 bg-white/10 text-white backdrop-blur hover:bg-white/15 data-[size=default]:h-9 [&_svg]:text-white/70">
								<SelectValue />
							</SelectTrigger>
							<SelectContent align="end">
								{RANGES.map((r) => (
									<SelectItem key={r} value={String(r)}>
										{r} วันล่าสุด
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				<div className="relative mt-6 flex flex-col gap-4 tablet:flex-row tablet:items-end tablet:justify-between">
					<div>
						<p className="text-sm text-white/60">ยอดขายวันนี้ทั้งแพลตฟอร์ม</p>
						<p className="numeric font-semibold text-4xl tracking-tight">{t ? <CountUp value={t.gmvToday} format={formatBaht} /> : "—"}</p>
						<p className="mt-1 text-sm text-white/60">
							{t ? `${formatNumber(t.ordersToday)} ออเดอร์วันนี้` : "กำลังโหลด…"}
						</p>
					</div>
					<div className="[&_label]:text-white/70">
						<DemoToggle />
					</div>
				</div>
			</motion.section>

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
							label={`ยอดขาย ${days} วัน`}
							loading={isLoading}
							value={t ? <CountUp value={t.gmvPeriod} format={formatBaht} /> : null}
							hint={t ? `${formatNumber(t.activeShopsPeriod)} ร้านที่มียอดขาย` : null}
							trend={series?.map((d) => d.gmv)}
						/>
						<StatCard
							tinted
							tone="primary"
							icon={ShoppingBag}
							label={`ออเดอร์ ${days} วัน`}
							loading={isLoading}
							value={t ? <CountUp value={t.ordersPeriod} format={formatNumber} /> : null}
							hint={t ? `สะสม ${formatNumber(t.ordersAllTime)} ออเดอร์` : null}
							trend={series?.map((d) => d.orders)}
						/>
						<StatCard
							tinted
							tone="info"
							icon={Store}
							label="ร้านค้าทั้งหมด"
							loading={isLoading}
							value={t ? <CountUp value={t.businesses} format={formatNumber} /> : null}
							hint={t ? `ใหม่ ${formatNumber(t.newBusinesses)} ร้านใน ${days} วัน` : null}
							trend={series?.map((d) => d.newBusinesses)}
						/>
						<StatCard
							tinted
							tone="warning"
							icon={Users}
							label="ผู้ใช้ทั้งหมด"
							loading={isLoading}
							value={t ? <CountUp value={t.users} format={formatNumber} /> : null}
							hint={t ? `สมัครใหม่ ${formatNumber(t.newUsers)} คนใน ${days} วัน` : null}
							trend={series?.map((d) => d.signups)}
						/>
					</Stagger>

					<Stagger trigger="mount" className="grid grid-cols-2 gap-3 desktop:grid-cols-3 desktop:gap-4">
						<StatCard
							tone="danger"
							icon={Undo2}
							label={`คืนเงิน ${days} วัน`}
							loading={isLoading}
							value={t ? <CountUp value={t.refundedAmountPeriod} format={formatBaht} /> : null}
							hint={t ? `${formatNumber(t.refundsPeriod)} ออเดอร์ · ยกเลิก ${formatNumber(t.cancelledPeriod)}` : null}
						/>
						<StatCard
							tone="primary"
							icon={ReceiptText}
							label="เฉลี่ยต่อออเดอร์"
							loading={isLoading}
							value={t ? <CountUp value={t.ordersPeriod ? Math.round(t.gmvPeriod / t.ordersPeriod) : 0} format={formatBaht} /> : null}
							hint={`${days} วันล่าสุด`}
						/>
						<StatCard
							// Two to a row on a phone: the odd third takes the whole row, as in apps/web.
							className="col-span-2 desktop:col-span-1"
							tone="success"
							icon={TrendingUp}
							label="ยอดขายเฉลี่ยต่อร้าน"
							loading={isLoading}
							value={
								t ? <CountUp value={t.activeShopsPeriod ? Math.round(t.gmvPeriod / t.activeShopsPeriod) : 0} format={formatBaht} /> : null
							}
							hint={`เฉพาะร้านที่มียอดขาย ${days} วัน`}
						/>
					</Stagger>

					<Surface>
						<SectionTitle title="ยอดขายรายวัน" hint="ออเดอร์ที่ชำระแล้ว ตามวันในเวลาไทย" />
						<div className="px-3 pb-4">
							{data ? (
								<DailyChart data={data.series} dataKey="gmv" kind="money" label="ยอดขาย" color={MEASURE_COLOR.gmv} height={280} />
							) : (
								<Skeleton className="mx-2 h-[280px]" />
							)}
						</div>
					</Surface>

					<div className="grid gap-4 desktop:grid-cols-2">
						<Surface>
							<SectionTitle title="ออเดอร์รายวัน" />
							<div className="px-3 pb-4">
								{data ? (
									<DailyChart data={data.series} dataKey="orders" kind="count" label="ออเดอร์" color={MEASURE_COLOR.orders} />
								) : (
									<Skeleton className="mx-2 h-[240px]" />
								)}
							</div>
						</Surface>
						<Surface>
							<SectionTitle title="ผู้ใช้สมัครใหม่รายวัน" />
							<div className="px-3 pb-4">
								{data ? (
									<DailyChart data={data.series} dataKey="signups" kind="count" label="สมัครใหม่" color={MEASURE_COLOR.signups} />
								) : (
									<Skeleton className="mx-2 h-[240px]" />
								)}
							</div>
						</Surface>
					</div>

					<div className="grid gap-4 desktop:grid-cols-2">
						<Surface>
							<SectionTitle title="ร้านตามแพ็กเกจ" hint="เฉพาะ subscription ที่ใช้งาน/ทดลองใช้" />
							{data ? <PlanBreakdown rows={data.subscriptions} /> : <Skeleton className="mx-5 mb-5 h-32" />}
						</Surface>
						<Surface>
							<SectionTitle title={`ร้านยอดขายสูงสุด (${days} วัน)`} />
							{data && data.topBusinesses.length === 0 ? (
								<EmptyState title="ยังไม่มียอดขายในช่วงนี้" />
							) : (
								<ol className="grid gap-1 px-3 pb-4">
									{(data?.topBusinesses ?? []).map((b, i) => (
										<li key={b.id}>
											<Link
												href={`/businesses/${b.id}`}
												className="flex min-h-11 items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted"
											>
												<span className="numeric flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted font-semibold text-muted-foreground text-xs">
													{i + 1}
												</span>
												<span className="min-w-0 flex-1 truncate font-medium text-sm">{b.name}</span>
												<span className="numeric hidden text-muted-foreground text-xs tablet:inline">
													{formatNumber(b.orders)} ออเดอร์
												</span>
												<span className="numeric w-28 text-right font-semibold text-sm">{formatBaht(b.gmv)}</span>
											</Link>
										</li>
									))}
								</ol>
							)}
						</Surface>
					</div>
				</>
			)}
		</div>
	);
}
