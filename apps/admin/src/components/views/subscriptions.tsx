"use client";

import { CountUp } from "@/components/motion/count-up";
import { Stagger } from "@/components/motion/reveal";
import { DemoToggle, useDemoFilter } from "@/components/common/demo-filter";
import {
	DesktopOnly,
	EmptyState,
	ErrorState,
	MobileList,
	MobileRow,
	PageHeader,
	Pager,
	RowsSkeleton,
	StatCard,
	StatusBadge,
	Surface,
} from "@/components/common/primitives";
import { Segmented } from "@/components/common/segmented";
import { useAdmin, useAdminPage } from "@/lib/admin-api";
import { PLAN_COLOR } from "@/lib/chart-colors";
import { PLAN_LABEL, SUBSCRIPTION_STATUS } from "@/lib/labels";
import type { AdminSubscriptionRow, AdminSubscriptionSummary } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@posly/ui/components/table";
import { formatNumber, formatThaiDate } from "@posly/utils/format";
import { formatBaht } from "@posly/utils/money";
import { CircleCheck, CircleSlash, Clock3, Coins, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { usePageFor } from "@/hooks/use-page-for";
import { useState } from "react";

const STATUSES = ["ACTIVE", "TRIALING", "PAST_DUE", "CANCELLED"] as const;

const STATUS_TONE = { ACTIVE: "success", TRIALING: "info", PAST_DUE: "warning", CANCELLED: "danger" } as const;
const STATUS_ICON = { ACTIVE: CircleCheck, TRIALING: Clock3, PAST_DUE: TriangleAlert, CANCELLED: CircleSlash } as const;

export function SubscriptionsView() {
	const { includeDemo } = useDemoFilter();
	const [status, setStatus] = useState("all");
	const [page, setPage] = usePageFor(JSON.stringify([status, includeDemo]));

	const summary = useAdmin<AdminSubscriptionSummary>("subscriptions/summary", { includeDemo });
	const { data, error, isLoading, refetch } = useAdminPage<AdminSubscriptionRow>("subscriptions", {
		page,
		limit: 25,
		status: status === "all" ? null : status,
		includeDemo,
	});
	const s = summary.data;

	return (
		<div className="grid gap-6">
			<PageHeader title="Subscriptions" description="แพ็กเกจของทุกร้าน" actions={<DemoToggle />} />

			<Stagger trigger="mount" className="grid grid-cols-2 gap-3 desktop:grid-cols-5 desktop:gap-4">
				<StatCard
					// Five cards, two to a row on a phone: MRR leads on a row of its own.
					className="col-span-2 desktop:col-span-1"
					tinted
					tone="success"
					icon={Coins}
					label="MRR"
					loading={summary.isLoading}
					value={s ? <CountUp value={s.mrr} format={formatBaht} /> : null}
					hint="ราคาต่อเดือนของแพ็กเกจที่ใช้งาน"
				/>
				{STATUSES.map((key) => (
					<StatCard
						key={key}
						tone={STATUS_TONE[key]}
						icon={STATUS_ICON[key]}
						label={SUBSCRIPTION_STATUS[key].label}
						loading={summary.isLoading}
						value={s ? <CountUp value={s.byStatus[key] ?? 0} format={formatNumber} /> : null}
					/>
				))}
			</Stagger>

			<Surface>
				<div className="overflow-x-auto border-b p-4">
					<Segmented
						value={status}
						onChange={setStatus}
						options={[
							{ value: "all", label: "ทั้งหมด" },
							...STATUSES.map((key) => ({ value: key, label: SUBSCRIPTION_STATUS[key].label })),
						]}
					/>
				</div>
				{error && !data ? (
					<ErrorState error={error} retry={() => refetch()} />
				) : isLoading ? (
					<RowsSkeleton />
				) : !data?.data.length ? (
					<EmptyState title="ไม่มี subscription ในสถานะนี้" />
				) : (
					<>
						<MobileList>
							{data.data.map((row) => {
								const st = SUBSCRIPTION_STATUS[row.status] ?? { label: row.status, tone: "neutral" as const };
								return (
									<MobileRow
										key={row.id}
										href={`/businesses/${row.businessId}`}
										title={
											<>
												<span className="truncate">{row.businessName}</span>
												<StatusBadge tone={st.tone}>{st.label}</StatusBadge>
											</>
										}
										meta={`${row.planName ?? PLAN_LABEL[row.plan] ?? row.plan} · ${row.endDate ? `ถึง ${formatThaiDate(row.endDate)}` : "ไม่มีกำหนด"}`}
										aside={<span className="numeric">{formatBaht(row.monthlyPrice)}</span>}
									/>
								);
							})}
						</MobileList>
						<DesktopOnly>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="pl-5">ร้าน</TableHead>
									<TableHead>แพ็กเกจ</TableHead>
									<TableHead>สถานะ</TableHead>
									<TableHead className="text-right">ราคา/เดือน</TableHead>
									<TableHead>เริ่ม</TableHead>
									<TableHead className="pr-5">สิ้นสุด</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{data.data.map((row) => {
									const st = SUBSCRIPTION_STATUS[row.status] ?? { label: row.status, tone: "neutral" as const };
									return (
										<TableRow key={row.id}>
											<TableCell className="pl-5 font-medium">
												<Link href={`/businesses/${row.businessId}`} className="hover:underline">
													{row.businessName}
												</Link>
											</TableCell>
											<TableCell>
												<span
													className="mr-2 inline-block size-2.5 rounded-full align-middle"
													style={{ backgroundColor: PLAN_COLOR[row.plan] ?? "var(--muted-foreground)" }}
													aria-hidden
												/>
												{row.planName ?? PLAN_LABEL[row.plan] ?? row.plan}
												{row.hasStripe ? <span className="ml-2 text-muted-foreground text-xs">Stripe</span> : null}
											</TableCell>
											<TableCell>
												<div className="flex items-center gap-2">
													<StatusBadge tone={st.tone}>{st.label}</StatusBadge>
													{row.cancelAtPeriodEnd ? <StatusBadge tone="warning">ยกเลิกเมื่อหมดรอบ</StatusBadge> : null}
												</div>
											</TableCell>
											<TableCell className="numeric text-right">{formatBaht(row.monthlyPrice)}</TableCell>
											<TableCell className="text-muted-foreground">{formatThaiDate(row.startDate)}</TableCell>
											<TableCell className="pr-5 text-muted-foreground">
												{row.endDate ? formatThaiDate(row.endDate) : "ไม่มีกำหนด"}
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
						</DesktopOnly>
						<Pager page={data.meta.page} lastPage={data.meta.last_page} total={data.meta.total} onPage={setPage} />
					</>
				)}
			</Surface>
		</div>
	);
}
