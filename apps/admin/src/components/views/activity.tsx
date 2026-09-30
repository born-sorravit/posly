"use client";

import { DemoToggle, useDemoFilter } from "@/components/common/demo-filter";
import { ErrorState, PageHeader, Pager, RowsSkeleton, SectionTitle, Surface } from "@/components/common/primitives";
import { AuditTable, OrdersTable } from "@/components/common/tables";
import { useAdmin, useAdminPage } from "@/lib/admin-api";
import { AUDIT_ACTION } from "@/lib/labels";
import type { AdminAuditRow, AdminOrderRow } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@posly/ui/components/select";
import { usePageFor } from "@/hooks/use-page-for";
import { useState } from "react";

export function ActivityView() {
	const { includeDemo } = useDemoFilter();
	const [action, setAction] = useState("all");
	const [page, setPage] = usePageFor(JSON.stringify([action, includeDemo]));

	const orders = useAdmin<AdminOrderRow[]>("orders/recent", { limit: 15, includeDemo }, 30_000);
	const audit = useAdminPage<AdminAuditRow>(
		"activity",
		{ page, limit: 20, action: action === "all" ? null : action, includeDemo },
		30_000
	);

	return (
		<div className="grid gap-6">
			<PageHeader title="กิจกรรม" description="ออเดอร์ล่าสุดและ audit log ของทุกร้าน อัปเดตทุก 30 วินาที" actions={<DemoToggle />} />

			<Surface>
				<SectionTitle title="ออเดอร์ล่าสุด" />
				{orders.error && !orders.data ? (
					<ErrorState error={orders.error} retry={() => orders.refetch()} />
				) : orders.data ? (
					<OrdersTable rows={orders.data} />
				) : (
					<RowsSkeleton rows={5} />
				)}
			</Surface>

			<Surface>
				<SectionTitle
					title="Audit log"
					hint="คืนเงิน ยกเลิกออเดอร์ และปรับสต็อก"
					action={
						<Select value={action} onValueChange={setAction}>
							<SelectTrigger className="w-44">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">ทุกการกระทำ</SelectItem>
								{Object.entries(AUDIT_ACTION).map(([key, label]) => (
									<SelectItem key={key} value={key}>
										{label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					}
				/>
				{audit.error && !audit.data ? (
					<ErrorState error={audit.error} retry={() => audit.refetch()} />
				) : audit.data ? (
					<>
						<AuditTable rows={audit.data.data} />
						<Pager
							page={audit.data.meta.page}
							lastPage={audit.data.meta.last_page}
							total={audit.data.meta.total}
							onPage={setPage}
						/>
					</>
				) : (
					<RowsSkeleton />
				)}
			</Surface>
		</div>
	);
}
