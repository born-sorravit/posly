"use client";

import { SetPlanDialog } from "@/components/actions/set-plan-dialog";
import { DailyChart } from "@/components/charts/daily-chart";
import { AdminActionsTable } from "@/components/common/admin-actions";
import { EmptyState, ErrorState, PageHeader, SectionTitle, StatCard, StatusBadge, Surface } from "@/components/common/primitives";
import { AuditTable, OrdersTable } from "@/components/common/tables";
import { AdminApiError, useAdmin } from "@/lib/admin-api";
import { BUSINESS_TYPE, MEMBER_STATUS, PLAN_LABEL, ROLE_LABEL, SUBSCRIPTION_STATUS } from "@/lib/labels";
import type { AdminBusinessDetail } from "@/lib/types";
import { Button } from "@posly/ui/components/button";
import { Skeleton } from "@posly/ui/components/skeleton";
import { formatNumber, formatThaiDate } from "@posly/utils/format";
import { formatBaht } from "@posly/utils/money";
import { ArrowLeft, Coins, Package, ReceiptText, UserRound } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

function Field({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="grid gap-0.5">
			<dt className="text-muted-foreground text-xs">{label}</dt>
			<dd className="text-sm">{children || "—"}</dd>
		</div>
	);
}

export function BusinessDetailView({ id }: { id: string }) {
	const { data, error, isLoading, refetch } = useAdmin<AdminBusinessDetail>(`businesses/${id}`);

	const back = (
		<Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
			<Link href="/businesses">
				<ArrowLeft />
				ร้านค้าทั้งหมด
			</Link>
		</Button>
	);

	if (error && !data) {
		return (
			<div className="grid gap-4">
				{back}
				<Surface>
					{error instanceof AdminApiError && (error.status === 404 || error.status === 400) ? (
						<EmptyState title="ไม่พบร้านนี้" description="ร้านอาจถูกลบไปแล้ว หรือลิงก์ไม่ถูกต้อง" />
					) : (
						<ErrorState error={error} retry={() => refetch()} />
					)}
				</Surface>
			</div>
		);
	}

	if (isLoading || !data) {
		return (
			<div className="grid gap-6">
				{back}
				<Skeleton className="h-10 w-64" />
				<div className="grid grid-cols-2 gap-4 desktop:grid-cols-4">
					{Array.from({ length: 4 }, (_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
						<Skeleton key={i} className="h-28 rounded-2xl" />
					))}
				</div>
				<Skeleton className="h-72 rounded-2xl" />
			</div>
		);
	}

	const { business, subscription, stats } = data;
	const status = subscription ? SUBSCRIPTION_STATUS[subscription.status] : null;

	return (
		<div className="grid gap-6">
			{back}
			<PageHeader
				title={business.name}
				description={
					<span className="flex flex-wrap items-center gap-2">
						{BUSINESS_TYPE[business.businessType] ?? business.businessType}
						<span aria-hidden>·</span>
						สมัครเมื่อ {formatThaiDate(business.createdAt)}
						{business.isDemo ? <StatusBadge tone="neutral">demo</StatusBadge> : null}
					</span>
				}
				actions={
					<div className="grid w-full justify-items-stretch gap-1 tablet:w-auto tablet:justify-items-end">
						<SetPlanDialog detail={data} />
						{subscription?.hasStripe ? (
							<p className="text-muted-foreground text-xs">ร้านนี้จ่ายผ่าน Stripe เปลี่ยนแพ็กเกจได้ที่ Stripe</p>
						) : null}
					</div>
				}
			/>

			<div className="grid grid-cols-2 gap-3 desktop:grid-cols-4 desktop:gap-4">
				<StatCard
					tinted
					tone="success"
					icon={Coins}
					label="ยอดขาย 30 วัน"
					value={formatBaht(stats.gmv30d)}
					hint={`${formatNumber(stats.orders30d)} ออเดอร์`}
					trend={data.series.map((d) => d.gmv)}
				/>
				<StatCard
					tinted
					tone="primary"
					icon={ReceiptText}
					label="ยอดขายสะสม"
					value={formatBaht(stats.gmvAllTime)}
					hint={`${formatNumber(stats.ordersAllTime)} ออเดอร์`}
				/>
				<StatCard tinted tone="info" icon={Package} label="สินค้า" value={formatNumber(stats.products)} />
				<StatCard tinted tone="warning" icon={UserRound} label="ลูกค้า" value={formatNumber(stats.customers)} />
			</div>

			<Surface>
				<SectionTitle title="ยอดขายรายวัน (30 วัน)" hint={`ตามเวลาของร้าน (${business.timezone})`} />
				<div className="px-3 pb-4">
					<DailyChart data={data.series} dataKey="gmv" kind="money" label="ยอดขาย" color="var(--success)" />
				</div>
			</Surface>

			<div className="grid gap-4 desktop:grid-cols-3">
				<Surface className="desktop:col-span-1">
					<SectionTitle title="ข้อมูลร้าน" />
					<dl className="grid gap-4 px-5 pb-5">
						<Field label="แพ็กเกจ">
							{subscription ? (
								<span className="flex flex-wrap items-center gap-2">
									{subscription.planName ?? PLAN_LABEL[subscription.plan] ?? subscription.plan}
									{status ? <StatusBadge tone={status.tone}>{status.label}</StatusBadge> : null}
									{subscription.cancelAtPeriodEnd ? <StatusBadge tone="warning">ยกเลิกเมื่อหมดรอบ</StatusBadge> : null}
								</span>
							) : null}
						</Field>
						{subscription ? (
							<Field label="รอบบิล">
								{formatThaiDate(subscription.startDate)} –{" "}
								{subscription.endDate ? formatThaiDate(subscription.endDate) : "ไม่มีกำหนด"}
								{subscription.hasStripe ? " · Stripe" : ""}
							</Field>
						) : null}
						<Field label="โทรศัพท์">{business.phone}</Field>
						<Field label="ที่อยู่">{business.address}</Field>
						<Field label="เลขผู้เสียภาษี">{business.taxId}</Field>
						<Field label="ตั้งค่าร้านเสร็จ">{business.onboardedAt ? formatThaiDate(business.onboardedAt) : "ยังไม่เสร็จ"}</Field>
						<Field label="รหัสร้าน">
							<code className="break-all text-xs">{business.id}</code>
						</Field>
					</dl>
				</Surface>

				<Surface className="desktop:col-span-2">
					<SectionTitle title={`สมาชิก (${data.members.length})`} />
					<ul className="grid px-5 pb-3">
						{data.members.map((m) => (
							<li key={m.id} className="flex items-center gap-3 border-t py-2.5 first:border-t-0">
								<div className="min-w-0 flex-1">
									<p className="truncate font-medium text-sm">{m.displayName}</p>
									<p className="truncate text-muted-foreground text-xs">{m.email ?? "—"}</p>
								</div>
								<StatusBadge tone="neutral">{ROLE_LABEL[m.role] ?? m.role}</StatusBadge>
								{m.status !== "ACTIVE" ? (
									<StatusBadge tone={m.status === "INVITED" ? "info" : "danger"}>
										{MEMBER_STATUS[m.status] ?? m.status}
									</StatusBadge>
								) : null}
							</li>
						))}
					</ul>
					<SectionTitle title={`สาขา (${data.branches.length})`} />
					<ul className="flex flex-wrap gap-2 px-5 pb-5">
						{data.branches.map((b) => (
							<li key={b.id} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm">
								{b.name}
								{b.isDefault ? <StatusBadge tone="info">หลัก</StatusBadge> : null}
								{!b.isActive ? <StatusBadge tone="neutral">ปิด</StatusBadge> : null}
							</li>
						))}
					</ul>
				</Surface>
			</div>

			<Surface>
				<SectionTitle title="ออเดอร์ล่าสุด" />
				<OrdersTable rows={data.recentOrders} showShop={false} />
			</Surface>

			<Surface>
				<SectionTitle title="กิจกรรมล่าสุด" hint="คืนเงิน ยกเลิกออเดอร์ และปรับสต็อก" />
				<AuditTable rows={data.recentActivity} showShop={false} />
			</Surface>

			<Surface>
				<SectionTitle title="การเปลี่ยนแปลงโดยผู้ดูแล" />
				<AdminActionsTable rows={data.adminActions} showTarget={false} />
			</Surface>
		</div>
	);
}
