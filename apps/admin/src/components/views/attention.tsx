"use client";

import { DemoToggle } from "@/components/common/demo-filter";
import {
	ErrorState,
	IconChip,
	MobileRow,
	PageHeader,
	RowsSkeleton,
	StatusBadge,
	Surface,
} from "@/components/common/primitives";
import { Stagger, StaggerItem } from "@/components/motion/reveal";
import { PLAN_LABEL } from "@/lib/labels";
import type { AdminAttentionResponse, AdminAttentionRow } from "@/lib/types";
import { useAttention } from "@/lib/use-attention";
import type { Tone } from "@posly/types/domain";
import { formatNumber, formatRelative, formatThaiDate } from "@posly/utils/format";
import { CalendarClock, CreditCard, Gauge, type LucideIcon, Moon, Rocket } from "lucide-react";
import type { ReactNode } from "react";

const planOf = (row: AdminAttentionRow) => (row.plan ? (PLAN_LABEL[row.plan] ?? row.plan) : "—");
const meta = (row: AdminAttentionRow) => `${row.ownerEmail ?? "ไม่มีเจ้าของ"} · ${planOf(row)}`;

/** Days from now until (or since) an ISO date, rounded, for "หมดใน 3 วัน". */
const daysFrom = (iso: string) => Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);

interface Section {
	key: keyof AdminAttentionResponse;
	title: string;
	hint: string;
	icon: LucideIcon;
	tone: Tone;
	aside: (row: AdminAttentionRow) => ReactNode;
}

const SECTIONS: Section[] = [
	{
		key: "pastDue",
		title: "ค้างชำระ",
		hint: "ตัดบัตรไม่ผ่าน Stripe กำลังลองใหม่ ถ้าไม่สำเร็จร้านจะกลับเป็น Free",
		icon: CreditCard,
		tone: "danger",
		aside: () => <StatusBadge tone="danger">ค้างชำระ</StatusBadge>,
	},
	{
		key: "expiring",
		title: "แพ็กเกจใกล้หมด",
		hint: "แพ็กเกจเสียเงินที่หมดใน 7 วัน หรือตั้งยกเลิกเมื่อหมดรอบไว้",
		icon: CalendarClock,
		tone: "warning",
		aside: (row) =>
			row.cancelAtPeriodEnd ? (
				<StatusBadge tone="warning">ยกเลิกเมื่อหมดรอบ</StatusBadge>
			) : row.endDate ? (
				<span className="numeric text-sm">
					{daysFrom(row.endDate) <= 0 ? "หมดวันนี้" : `หมดใน ${daysFrom(row.endDate)} วัน`}
					<span className="block text-muted-foreground text-xs">{formatThaiDate(row.endDate)}</span>
				</span>
			) : null,
	},
	{
		key: "nearQuota",
		title: "ออเดอร์ใกล้เต็มโควตา",
		hint: "ใช้ไปแล้ว 80% ขึ้นไปของโควตาเดือนนี้ โอกาสแนะนำให้อัปเกรด",
		icon: Gauge,
		tone: "primary",
		aside: (row) => {
			const used = row.ordersThisMonth ?? 0;
			const limit = row.orderLimit ?? 1;
			return (
				<span className="grid w-28 gap-1 text-right">
					<span className="numeric text-sm">
						{formatNumber(used)} / {formatNumber(limit)}
					</span>
					<span className="h-1.5 rounded-full bg-muted">
						<span
							className={used >= limit ? "block h-1.5 rounded-full bg-danger" : "block h-1.5 rounded-full bg-primary"}
							style={{ width: `${Math.min(100, (used / limit) * 100)}%` }}
						/>
					</span>
				</span>
			);
		},
	},
	{
		key: "dormant",
		title: "เงียบไป",
		hint: "เคยมียอดขาย แต่ไม่มีออเดอร์ใหม่ใน 7 วันที่ผ่านมา",
		icon: Moon,
		tone: "info",
		aside: (row) =>
			row.lastOrderAt ? (
				<span className="text-muted-foreground text-xs">ขายล่าสุด {formatRelative(row.lastOrderAt)}</span>
			) : null,
	},
	{
		key: "notOnboarded",
		title: "ตั้งค่าร้านไม่เสร็จ",
		hint: "สมัครเกิน 3 วันแล้ว แต่ยังไม่ผ่านขั้นตอนตั้งค่าร้าน",
		icon: Rocket,
		tone: "success",
		aside: (row) => <span className="text-muted-foreground text-xs">สมัคร {formatRelative(row.createdAt)}</span>,
	},
];

export function AttentionView() {
	const { data, error, isLoading, refetch, total } = useAttention();

	return (
		<div className="grid gap-6">
			<PageHeader
				title="ต้องดูแล"
				description={data ? `${formatNumber(total)} ร้านที่ควรดู · อัปเดตทุก 5 นาที` : "ร้านที่ควรดู แยกตามเหตุผล"}
				actions={<DemoToggle />}
			/>

			{error && !data ? (
				<Surface>
					<ErrorState error={error} retry={() => refetch()} />
				</Surface>
			) : (
				<Stagger trigger="mount" className="grid gap-4 desktop:grid-cols-2">
					{SECTIONS.map((section) => {
						const rows = data?.[section.key] ?? [];
						return (
							<StaggerItem key={section.key}>
							<Surface className="h-full">
								<div className="flex items-start gap-3 px-5 pt-5 pb-4">
									<IconChip icon={section.icon} tone={section.tone} className="size-9 rounded-lg [&_svg]:size-5" />
									<div className="min-w-0 flex-1">
										<h2 className="flex items-center gap-2 font-semibold text-base">
											{section.title}
											{data ? (
												<span className="numeric rounded-md bg-muted px-1.5 font-medium text-muted-foreground text-xs">
													{formatNumber(rows.length)}
												</span>
											) : null}
										</h2>
										<p className="text-muted-foreground text-xs">{section.hint}</p>
									</div>
								</div>
								{isLoading ? (
									<RowsSkeleton rows={2} />
								) : rows.length === 0 ? (
									<p className="border-t px-5 py-4 text-muted-foreground text-sm">ไม่มีร้านในรายการนี้</p>
								) : (
									<ul className="divide-y border-t">
										{rows.map((row) => (
											<MobileRow
												key={row.businessId}
												href={`/businesses/${row.businessId}`}
												title={<span className="truncate">{row.businessName}</span>}
												meta={meta(row)}
												aside={section.aside(row)}
											/>
										))}
									</ul>
								)}
							</Surface>
							</StaggerItem>
						);
					})}
				</Stagger>
			)}
		</div>
	);
}
