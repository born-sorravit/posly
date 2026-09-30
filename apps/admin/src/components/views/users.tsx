"use client";

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
	StatusBadge,
	Surface,
} from "@/components/common/primitives";
import { SearchInput } from "@/components/common/search-input";
import { useDebounced } from "@/hooks/use-debounced";
import { useAdminPage } from "@/lib/admin-api";
import type { AdminUserRow } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@posly/ui/components/table";
import { formatNumber, formatRelative, formatThaiDate } from "@posly/utils/format";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePageFor } from "@/hooks/use-page-for";
import { useState } from "react";

export function UsersView() {
	const router = useRouter();
	const { includeDemo } = useDemoFilter();
	const [search, setSearch] = useState("");
	const q = useDebounced(search);
	const [page, setPage] = usePageFor(JSON.stringify([q, includeDemo]));

	const { data, error, isLoading, refetch } = useAdminPage<AdminUserRow>("users", {
		page,
		limit: 25,
		search: q,
		includeDemo,
	});

	return (
		<div className="grid gap-6">
			<PageHeader title="ผู้ใช้" description="ทุกบัญชีบนแพลตฟอร์ม ใช้งานล่าสุด = ครั้งล่าสุดที่ต่ออายุ session" actions={<DemoToggle />} />
			<Surface>
				<div className="border-b p-4">
					<SearchInput value={search} onChange={setSearch} placeholder="ค้นหาอีเมล หรือชื่อ" />
				</div>
				{error && !data ? (
					<ErrorState error={error} retry={() => refetch()} />
				) : isLoading ? (
					<RowsSkeleton />
				) : !data?.data.length ? (
					<EmptyState title="ไม่พบผู้ใช้" />
				) : (
					<>
						<MobileList>
							{data.data.map((u) => (
								<MobileRow
									key={u.id}
									href={`/users/${u.id}`}
									title={
										<>
											<span className="truncate">{u.name}</span>
											{u.isPlatformAdmin ? <StatusBadge tone="info">admin</StatusBadge> : null}
											{u.isDemo ? <StatusBadge tone="neutral">demo</StatusBadge> : null}
										</>
									}
									meta={u.email}
									aside={
										<span className="text-muted-foreground text-xs">
											{u.lastSeenAt ? formatRelative(u.lastSeenAt) : "—"}
										</span>
									}
								/>
							))}
						</MobileList>
						<DesktopOnly>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="pl-5">ผู้ใช้</TableHead>
									<TableHead>เข้าสู่ระบบด้วย</TableHead>
									<TableHead className="text-right">ร้านที่สังกัด</TableHead>
									<TableHead>ใช้งานล่าสุด</TableHead>
									<TableHead className="pr-5">สมัครเมื่อ</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{data.data.map((u) => (
									<TableRow key={u.id} className="cursor-pointer" onClick={() => router.push(`/users/${u.id}`)}>
										<TableCell className="pl-5">
											<div className="flex items-center gap-2 font-medium">
												<Link href={`/users/${u.id}`} className="hover:underline">
													{u.name}
												</Link>
												{u.isPlatformAdmin ? <StatusBadge tone="info">admin</StatusBadge> : null}
												{u.isDemo ? <StatusBadge tone="neutral">demo</StatusBadge> : null}
											</div>
											<div className="text-muted-foreground text-xs">{u.email}</div>
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-2">
												{u.provider === "GOOGLE" ? "Google" : "อีเมล"}
												{!u.isVerified ? <StatusBadge tone="warning">ยังไม่ยืนยัน</StatusBadge> : null}
											</div>
										</TableCell>
										<TableCell className="numeric text-right">{formatNumber(u.shops)}</TableCell>
										<TableCell className="text-muted-foreground">
											{u.lastSeenAt ? formatRelative(u.lastSeenAt) : "—"}
										</TableCell>
										<TableCell className="pr-5 text-muted-foreground">{formatThaiDate(u.createdAt)}</TableCell>
									</TableRow>
								))}
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
