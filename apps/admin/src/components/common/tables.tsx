"use client";

import { DesktopOnly, EmptyState, MobileList, MobileRow, StatusBadge } from "@/components/common/primitives";
import { AUDIT_ACTION, ORDER_STATUS } from "@/lib/labels";
import type { AdminAuditRow, AdminOrderRow } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@posly/ui/components/table";
import { formatDateTime } from "@posly/utils/format";
import { formatBaht } from "@posly/utils/money";
import Link from "next/link";

/** Orders across shops; `showShop` off when the page is already about one shop. */
export function OrdersTable({ rows, showShop = true }: { rows: AdminOrderRow[]; showShop?: boolean }) {
	if (!rows.length) return <EmptyState title="ยังไม่มีออเดอร์" />;
	return (
		<>
		<MobileList>
			{rows.map((o) => {
				const status = ORDER_STATUS[o.status] ?? { label: o.status, tone: "neutral" as const };
				return (
					<MobileRow
						key={o.id}
						href={showShop ? `/businesses/${o.businessId}` : undefined}
						title={
							<>
								<span className="numeric">#{o.number}</span>
								<StatusBadge tone={status.tone}>{status.label}</StatusBadge>
							</>
						}
						meta={`${showShop ? `${o.businessName} · ` : ""}${o.employeeName} · ${formatDateTime(o.createdAt)}`}
						aside={<span className="numeric font-medium">{formatBaht(o.total)}</span>}
					/>
				);
			})}
		</MobileList>
		<DesktopOnly>
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead className="pl-5">เลขที่</TableHead>
					{showShop ? <TableHead>ร้าน</TableHead> : null}
					<TableHead>สถานะ</TableHead>
					<TableHead>พนักงาน</TableHead>
					<TableHead className="text-right">ยอด</TableHead>
					<TableHead className="pr-5">เวลา</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{rows.map((o) => {
					const status = ORDER_STATUS[o.status] ?? { label: o.status, tone: "neutral" as const };
					return (
						<TableRow key={o.id}>
							<TableCell className="numeric pl-5 font-medium">#{o.number}</TableCell>
							{showShop ? (
								<TableCell>
									<Link href={`/businesses/${o.businessId}`} className="hover:underline">
										{o.businessName}
									</Link>
								</TableCell>
							) : null}
							<TableCell>
								<StatusBadge tone={status.tone}>{status.label}</StatusBadge>
							</TableCell>
							<TableCell className="text-muted-foreground">{o.employeeName}</TableCell>
							<TableCell className="numeric text-right font-medium">{formatBaht(o.total)}</TableCell>
							<TableCell className="pr-5 text-muted-foreground">{formatDateTime(o.createdAt)}</TableCell>
						</TableRow>
					);
				})}
			</TableBody>
		</Table>
		</DesktopOnly>
		</>
	);
}

/** Refunds and cancels carry `{ total, reason }`; stock adjustments `{ before, after, note }`. */
const payloadSummary = (row: AdminAuditRow) => {
	const { payload } = row;
	const parts: string[] = [];
	if (typeof payload.total === "number") parts.push(formatBaht(payload.total));
	if (typeof payload.before === "number" && typeof payload.after === "number") {
		parts.push(`สต็อก ${payload.before} → ${payload.after}`);
	}
	if (typeof payload.reason === "string" && payload.reason) parts.push(payload.reason);
	if (typeof payload.note === "string" && payload.note) parts.push(payload.note);
	return parts.join(" · ") || "—";
};

export function AuditTable({ rows, showShop = true }: { rows: AdminAuditRow[]; showShop?: boolean }) {
	if (!rows.length) return <EmptyState title="ยังไม่มีกิจกรรม" />;
	return (
		<>
		<MobileList>
			{rows.map((a) => (
				<MobileRow
					key={a.id}
					href={showShop ? `/businesses/${a.businessId}` : undefined}
					title={
						<StatusBadge tone={a.action === "STOCK_ADJUSTED" ? "info" : "warning"}>
							{AUDIT_ACTION[a.action] ?? a.action}
						</StatusBadge>
					}
					meta={`${showShop ? `${a.businessName} · ` : ""}${a.actorName} · ${formatDateTime(a.createdAt)}`}
					aside={<span className="text-muted-foreground text-xs">{payloadSummary(a)}</span>}
				/>
			))}
		</MobileList>
		<DesktopOnly>
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead className="pl-5">การกระทำ</TableHead>
					{showShop ? <TableHead>ร้าน</TableHead> : null}
					<TableHead>ผู้ทำ</TableHead>
					<TableHead>รายละเอียด</TableHead>
					<TableHead className="pr-5">เวลา</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{rows.map((a) => (
					<TableRow key={a.id}>
						<TableCell className="pl-5">
							<StatusBadge tone={a.action === "STOCK_ADJUSTED" ? "info" : "warning"}>
								{AUDIT_ACTION[a.action] ?? a.action}
							</StatusBadge>
						</TableCell>
						{showShop ? (
							<TableCell>
								<Link href={`/businesses/${a.businessId}`} className="hover:underline">
									{a.businessName}
								</Link>
							</TableCell>
						) : null}
						<TableCell>{a.actorName}</TableCell>
						<TableCell className="max-w-72 truncate text-muted-foreground">{payloadSummary(a)}</TableCell>
						<TableCell className="pr-5 text-muted-foreground">{formatDateTime(a.createdAt)}</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
		</DesktopOnly>
		</>
	);
}
