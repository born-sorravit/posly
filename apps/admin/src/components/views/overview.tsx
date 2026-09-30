"use client";

import { DailyChart } from "@/components/charts/daily-chart";
import { DemoToggle, useDemoFilter } from "@/components/common/demo-filter";
import { EmptyState, ErrorState, PageHeader, SectionTitle, StatCard, Surface } from "@/components/common/primitives";
import { useAdmin } from "@/lib/admin-api";
import { PLAN_LABEL } from "@/lib/labels";
import type { AdminOverviewResponse } from "@/lib/types";
import { Skeleton } from "@posly/ui/components/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@posly/ui/components/tabs";
import { formatNumber } from "@posly/utils/format";
import { formatBaht } from "@posly/utils/money";
import { Banknote, CreditCard, ReceiptText, Store, Undo2, Users } from "lucide-react";
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
						<span>{PLAN_LABEL[plan] ?? plan}</span>
						<span className="numeric font-medium">{formatNumber(count)}</span>
					</div>
					<div className="h-2 rounded-full bg-muted">
						<div
							className="h-2 rounded-full bg-chart-1"
							style={{ width: `${(count / max) * 100}%`, minWidth: count ? 8 : 0 }}
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

	return (
		<div className="grid gap-6">
			<PageHeader
				title="ภาพรวมแพลตฟอร์ม"
				description="ตัวเลขทั้งระบบ อัปเดตอัตโนมัติทุก 1 นาที"
				actions={
					<>
						<DemoToggle />
						<Tabs value={String(days)} onValueChange={(v) => setDays(Number(v))}>
							<TabsList>
								{RANGES.map((r) => (
									<TabsTrigger key={r} value={String(r)}>
										{r} วัน
									</TabsTrigger>
								))}
							</TabsList>
						</Tabs>
					</>
				}
			/>

			{error && !data ? (
				<Surface>
					<ErrorState error={error} retry={() => refetch()} />
				</Surface>
			) : (
				<>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 desktop:grid-cols-3">
						<StatCard
							label="ยอดขายวันนี้"
							icon={Banknote}
							loading={isLoading}
							value={t ? formatBaht(t.gmvToday) : null}
							hint={t ? `${formatNumber(t.ordersToday)} ออเดอร์` : null}
						/>
						<StatCard
							label={`ยอดขาย ${days} วัน`}
							icon={ReceiptText}
							loading={isLoading}
							value={t ? formatBaht(t.gmvPeriod) : null}
							hint={t ? `${formatNumber(t.ordersPeriod)} ออเดอร์ · ${formatNumber(t.activeShopsPeriod)} ร้านที่มียอดขาย` : null}
						/>
						<StatCard
							label="ร้านค้าทั้งหมด"
							icon={Store}
							loading={isLoading}
							value={t ? formatNumber(t.businesses) : null}
							hint={t ? `ใหม่ ${formatNumber(t.newBusinesses)} ร้านใน ${days} วัน` : null}
						/>
						<StatCard
							label="ผู้ใช้ทั้งหมด"
							icon={Users}
							loading={isLoading}
							value={t ? formatNumber(t.users) : null}
							hint={t ? `สมัครใหม่ ${formatNumber(t.newUsers)} คนใน ${days} วัน` : null}
						/>
						<StatCard
							label={`คืนเงิน / ยกเลิก (${days} วัน)`}
							icon={Undo2}
							loading={isLoading}
							value={t ? `${formatNumber(t.refundsPeriod)} / ${formatNumber(t.cancelledPeriod)}` : null}
							hint={t ? `คืนเงินรวม ${formatBaht(t.refundedAmountPeriod)}` : null}
						/>
						<StatCard
							label="ออเดอร์สะสม"
							icon={CreditCard}
							loading={isLoading}
							value={t ? formatNumber(t.ordersAllTime) : null}
							hint="ออเดอร์ที่ชำระแล้วทั้งหมด"
						/>
					</div>

					<Surface>
						<SectionTitle title="ยอดขายรายวัน" hint="ออเดอร์ที่ชำระแล้ว ตามวันในเวลาไทย" />
						<div className="px-3 pb-4">
							{data ? (
								<DailyChart data={data.series} dataKey="gmv" kind="money" label="ยอดขาย" height={280} />
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
									<DailyChart data={data.series} dataKey="orders" kind="count" label="ออเดอร์" color="var(--chart-2)" />
								) : (
									<Skeleton className="mx-2 h-[240px]" />
								)}
							</div>
						</Surface>
						<Surface>
							<SectionTitle title="ผู้ใช้สมัครใหม่รายวัน" />
							<div className="px-3 pb-4">
								{data ? (
									<DailyChart data={data.series} dataKey="signups" kind="count" label="สมัครใหม่" color="var(--chart-3)" />
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
												className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted"
											>
												<span className="numeric w-5 text-muted-foreground text-sm">{i + 1}</span>
												<span className="min-w-0 flex-1 truncate font-medium">{b.name}</span>
												<span className="numeric text-muted-foreground text-xs">{formatNumber(b.orders)} ออเดอร์</span>
												<span className="numeric w-28 text-right font-medium">{formatBaht(b.gmv)}</span>
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
