"use client";

import { DesktopOnly, EmptyState, MobileList, MobileRow, StatusBadge } from "@/components/common/primitives";
import { ADMIN_ACTION, PLAN_LABEL } from "@/lib/labels";
import type { AdminActionRow } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@posly/ui/components/table";
import { formatDateTime, formatThaiDate } from "@posly/utils/format";
import Link from "next/link";

const targetHref = (a: AdminActionRow) =>
	a.targetType === "business" ? `/businesses/${a.targetId}` : `/users/${a.targetId}`;

/** One line saying what changed, from the action's payload. */
const describe = (a: AdminActionRow): string => {
	const p = a.payload;
	const note = typeof p.note === "string" && p.note ? ` · ${p.note}` : "";
	if (a.action === "SUBSCRIPTION_SET") {
		const from = typeof p.from === "string" ? (PLAN_LABEL[p.from] ?? p.from) : "—";
		const to = typeof p.to === "string" ? (PLAN_LABEL[p.to] ?? p.to) : "—";
		const until = typeof p.endDate === "string" ? ` ถึง ${formatThaiDate(p.endDate)}` : " ไม่มีกำหนด";
		return `${from} → ${to}${until}${note}`;
	}
	if (a.action === "SESSIONS_REVOKED") {
		return `${typeof p.revoked === "number" ? p.revoked : 0} อุปกรณ์${note}`;
	}
	return note.slice(3) || "—";
};

/** What platform admins changed; `showTarget` off on a page already about that target. */
export function AdminActionsTable({ rows, showTarget = true }: { rows: AdminActionRow[]; showTarget?: boolean }) {
	if (!rows.length) return <EmptyState title="ยังไม่มีการเปลี่ยนแปลงโดยผู้ดูแล" />;
	return (
		<>
			<MobileList>
				{rows.map((a) => (
					<MobileRow
						key={a.id}
						href={showTarget ? targetHref(a) : undefined}
						title={<StatusBadge tone="info">{ADMIN_ACTION[a.action] ?? a.action}</StatusBadge>}
						meta={`${showTarget && a.targetName ? `${a.targetName} · ` : ""}${a.adminEmail} · ${formatDateTime(a.createdAt)}`}
						aside={<span className="text-muted-foreground text-xs">{describe(a)}</span>}
					/>
				))}
			</MobileList>
			<DesktopOnly>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="pl-5">การกระทำ</TableHead>
							{showTarget ? <TableHead>ที่</TableHead> : null}
							<TableHead>รายละเอียด</TableHead>
							<TableHead>ผู้ดูแล</TableHead>
							<TableHead className="pr-5">เวลา</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((a) => (
							<TableRow key={a.id}>
								<TableCell className="pl-5">
									<StatusBadge tone="info">{ADMIN_ACTION[a.action] ?? a.action}</StatusBadge>
								</TableCell>
								{showTarget ? (
									<TableCell>
										<Link href={targetHref(a)} className="hover:underline">
											{a.targetName ?? a.targetId}
										</Link>
									</TableCell>
								) : null}
								<TableCell className="max-w-80 truncate text-muted-foreground">{describe(a)}</TableCell>
								<TableCell className="text-muted-foreground">{a.adminEmail}</TableCell>
								<TableCell className="pr-5 text-muted-foreground">{formatDateTime(a.createdAt)}</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</DesktopOnly>
		</>
	);
}
