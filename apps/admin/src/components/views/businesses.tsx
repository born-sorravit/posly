"use client";

import { DemoToggle, useDemoFilter } from "@/components/common/demo-filter";
import { EmptyState, ErrorState, PageHeader, Pager, RowsSkeleton, StatusBadge, Surface } from "@/components/common/primitives";
import { SearchInput } from "@/components/common/search-input";
import { useDebounced } from "@/hooks/use-debounced";
import { useAdminPage } from "@/lib/admin-api";
import { BUSINESS_TYPE, PLAN_LABEL, SUBSCRIPTION_STATUS } from "@/lib/labels";
import type { AdminBusinessRow } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@posly/ui/components/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@posly/ui/components/table";
import { formatNumber, formatRelative, formatThaiDate } from "@posly/utils/format";
import { formatBaht } from "@posly/utils/money";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePageFor } from "@/hooks/use-page-for";
import { useState } from "react";

const SORTS = [
	{ value: "createdAt", label: "สมัครล่าสุด" },
	{ value: "gmv30d", label: "ยอดขาย 30 วัน" },
	{ value: "orders30d", label: "ออเดอร์ 30 วัน" },
	{ value: "lastOrderAt", label: "ขายล่าสุด" },
	{ value: "name", label: "ชื่อร้าน" },
];

export function BusinessesView() {
	const router = useRouter();
	const { includeDemo } = useDemoFilter();
	const [search, setSearch] = useState("");
	const [plan, setPlan] = useState("all");
	const [sortBy, setSortBy] = useState("createdAt");
	const q = useDebounced(search);

	const [page, setPage] = usePageFor(JSON.stringify([q, plan, sortBy, includeDemo]));

	const { data, error, isLoading, refetch } = useAdminPage<AdminBusinessRow>("businesses", {
		page,
		limit: 20,
		search: q,
		plan: plan === "all" ? null : plan,
		sortBy,
		order: sortBy === "name" ? "ASC" : "DESC",
		includeDemo,
	});

	return (
		<div className="grid gap-6">
			<PageHeader title="ร้านค้า" description="ทุกร้านบนแพลตฟอร์ม พร้อมแพ็กเกจและยอดขาย 30 วันล่าสุด" actions={<DemoToggle />} />

			<Surface>
				<div className="flex flex-wrap items-center gap-3 border-b p-4">
					<SearchInput value={search} onChange={setSearch} placeholder="ค้นหาชื่อร้าน หรืออีเมลเจ้าของ" />
					<Select value={plan} onValueChange={setPlan}>
						<SelectTrigger className="w-40">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">ทุกแพ็กเกจ</SelectItem>
							{Object.entries(PLAN_LABEL).map(([code, label]) => (
								<SelectItem key={code} value={code}>
									{label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select value={sortBy} onValueChange={setSortBy}>
						<SelectTrigger className="w-44">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{SORTS.map((s) => (
								<SelectItem key={s.value} value={s.value}>
									เรียง: {s.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{error && !data ? (
					<ErrorState error={error} retry={() => refetch()} />
				) : isLoading ? (
					<RowsSkeleton />
				) : !data?.data.length ? (
					<EmptyState title="ไม่พบร้านค้า" description={includeDemo ? undefined : "ร้าน demo ถูกซ่อนอยู่ — เปิด “รวมร้าน demo” เพื่อดู"} />
				) : (
					<>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="pl-5">ร้าน</TableHead>
									<TableHead>แพ็กเกจ</TableHead>
									<TableHead className="text-right">สมาชิก / สาขา</TableHead>
									<TableHead className="text-right">ออเดอร์ 30 วัน</TableHead>
									<TableHead className="text-right">ยอดขาย 30 วัน</TableHead>
									<TableHead>ขายล่าสุด</TableHead>
									<TableHead className="pr-5">สมัครเมื่อ</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{data.data.map((b) => {
									const status = b.subscriptionStatus ? SUBSCRIPTION_STATUS[b.subscriptionStatus] : null;
									return (
										<TableRow
											key={b.id}
											className="cursor-pointer"
											onClick={() => router.push(`/businesses/${b.id}`)}
										>
											<TableCell className="pl-5">
												<div className="flex items-center gap-2 font-medium">
													<Link href={`/businesses/${b.id}`} className="hover:underline">
														{b.name}
													</Link>
													{b.isDemo ? <StatusBadge tone="neutral">demo</StatusBadge> : null}
												</div>
												<div className="text-muted-foreground text-xs">
													{BUSINESS_TYPE[b.businessType] ?? b.businessType} · {b.ownerEmail ?? "—"}
												</div>
											</TableCell>
											<TableCell>
												<div className="flex items-center gap-2">
													<span>{b.plan ? (PLAN_LABEL[b.plan] ?? b.plan) : "—"}</span>
													{status && b.subscriptionStatus !== "ACTIVE" ? (
														<StatusBadge tone={status.tone}>{status.label}</StatusBadge>
													) : null}
												</div>
											</TableCell>
											<TableCell className="numeric text-right">
												{formatNumber(b.members)} / {formatNumber(b.branches)}
											</TableCell>
											<TableCell className="numeric text-right">{formatNumber(b.orders30d)}</TableCell>
											<TableCell className="numeric text-right font-medium">{formatBaht(b.gmv30d)}</TableCell>
											<TableCell className="text-muted-foreground">
												{b.lastOrderAt ? formatRelative(b.lastOrderAt) : "—"}
											</TableCell>
											<TableCell className="pr-5 text-muted-foreground">{formatThaiDate(b.createdAt)}</TableCell>
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
