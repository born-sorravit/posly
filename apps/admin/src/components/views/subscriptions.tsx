"use client";

import { DemoToggle, useDemoFilter } from "@/components/common/demo-filter";
import { EmptyState, ErrorState, PageHeader, Pager, RowsSkeleton, StatCard, StatusBadge, Surface } from "@/components/common/primitives";
import { useAdmin, useAdminPage } from "@/lib/admin-api";
import { PLAN_LABEL, SUBSCRIPTION_STATUS } from "@/lib/labels";
import type { AdminSubscriptionRow, AdminSubscriptionSummary } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@posly/ui/components/table";
import { Tabs, TabsList, TabsTrigger } from "@posly/ui/components/tabs";
import { formatNumber, formatThaiDate } from "@posly/utils/format";
import { formatBaht } from "@posly/utils/money";
import Link from "next/link";
import { usePageFor } from "@/hooks/use-page-for";
import { useState } from "react";

const STATUSES = ["ACTIVE", "TRIALING", "PAST_DUE", "CANCELLED"] as const;

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

			<div className="grid grid-cols-2 gap-4 desktop:grid-cols-5">
				<StatCard label="MRR" loading={summary.isLoading} value={s ? formatBaht(s.mrr) : null} hint="รวมราคาต่อเดือนของแพ็กเกจที่ใช้งาน" />
				{STATUSES.map((key) => (
					<StatCard
						key={key}
						label={SUBSCRIPTION_STATUS[key].label}
						loading={summary.isLoading}
						value={s ? formatNumber(s.byStatus[key] ?? 0) : null}
					/>
				))}
			</div>

			<Surface>
				<div className="overflow-x-auto border-b p-4">
					<Tabs value={status} onValueChange={setStatus}>
						<TabsList>
							<TabsTrigger value="all">ทั้งหมด</TabsTrigger>
							{STATUSES.map((key) => (
								<TabsTrigger key={key} value={key}>
									{SUBSCRIPTION_STATUS[key].label}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				</div>
				{error && !data ? (
					<ErrorState error={error} retry={() => refetch()} />
				) : isLoading ? (
					<RowsSkeleton />
				) : !data?.data.length ? (
					<EmptyState title="ไม่มี subscription ในสถานะนี้" />
				) : (
					<>
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
						<Pager page={data.meta.page} lastPage={data.meta.last_page} total={data.meta.total} onPage={setPage} />
					</>
				)}
			</Surface>
		</div>
	);
}
