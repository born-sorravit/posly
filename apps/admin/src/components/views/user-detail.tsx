"use client";

import { RevokeSessionsDialog } from "@/components/actions/revoke-sessions-dialog";
import { AdminActionsTable } from "@/components/common/admin-actions";
import {
	EmptyState,
	ErrorState,
	MobileRow,
	PageHeader,
	SectionTitle,
	StatusBadge,
	Surface,
} from "@/components/common/primitives";
import { AdminApiError, useAdmin } from "@/lib/admin-api";
import { MEMBER_STATUS, PLAN_LABEL, ROLE_LABEL } from "@/lib/labels";
import type { AdminUserDetail } from "@/lib/types";
import { Button } from "@posly/ui/components/button";
import { Skeleton } from "@posly/ui/components/skeleton";
import { formatDateTime, formatRelative, formatThaiDate } from "@posly/utils/format";
import { ArrowLeft, Monitor, Smartphone } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** "Chrome บน macOS" from a user agent: enough to recognise a device, never used for auth. */
const deviceOf = (ua: string | null): string => {
	if (!ua) return "ไม่ทราบอุปกรณ์";
	const browser = /Edg\//.test(ua)
		? "Edge"
		: /Chrome\//.test(ua)
			? "Chrome"
			: /Firefox\//.test(ua)
				? "Firefox"
				: /Safari\//.test(ua)
					? "Safari"
					: "เบราว์เซอร์อื่น";
	const os = /iPhone|iPad/.test(ua)
		? "iOS"
		: /Android/.test(ua)
			? "Android"
			: /Mac OS X/.test(ua)
				? "macOS"
				: /Windows/.test(ua)
					? "Windows"
					: /Linux/.test(ua)
						? "Linux"
						: "";
	return os ? `${browser} บน ${os}` : browser;
};

/** The newest few are what an admin checks; the count in the title covers the rest. */
const SESSIONS_SHOWN = 10;

const isPhone = (ua: string | null) => !!ua && /iPhone|Android|Mobile/.test(ua);

export function UserDetailView({ id, currentUserId }: { id: string; currentUserId: string | null }) {
	const { data, error, isLoading, refetch } = useAdmin<AdminUserDetail>(`users/${id}`);

	const back = (
		<Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
			<Link href="/users">
				<ArrowLeft />
				ผู้ใช้ทั้งหมด
			</Link>
		</Button>
	);

	if (error && !data) {
		return (
			<div className="grid gap-4">
				{back}
				<Surface>
					{error instanceof AdminApiError && (error.status === 404 || error.status === 400) ? (
						<EmptyState title="ไม่พบผู้ใช้นี้" description="บัญชีอาจถูกลบไปแล้ว หรือลิงก์ไม่ถูกต้อง" />
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
				<Skeleton className="h-40 rounded-2xl" />
				<Skeleton className="h-56 rounded-2xl" />
			</div>
		);
	}

	const { user, memberships, sessions, actions } = data;

	return (
		<div className="grid gap-6">
			{back}
			<PageHeader
				title={user.name}
				description={
					<span className="flex flex-wrap items-center gap-2">
						{user.email}
						{user.isPlatformAdmin ? <StatusBadge tone="info">admin</StatusBadge> : null}
						{user.isDemo ? <StatusBadge tone="neutral">demo</StatusBadge> : null}
						{!user.isVerified ? <StatusBadge tone="warning">ยังไม่ยืนยันอีเมล</StatusBadge> : null}
					</span>
				}
				actions={
					<RevokeSessionsDialog
						userId={user.id}
						email={user.email}
						sessions={sessions.length}
						isSelf={user.id === currentUserId}
					/>
				}
			/>

			<Surface>
				<dl className="grid grid-cols-2 gap-4 p-5 desktop:grid-cols-4">
					<div className="grid gap-0.5">
						<dt className="text-muted-foreground text-xs">เข้าสู่ระบบด้วย</dt>
						<dd className="text-sm">{user.provider === "GOOGLE" ? "Google" : "อีเมลและรหัสผ่าน"}</dd>
					</div>
					<div className="grid gap-0.5">
						<dt className="text-muted-foreground text-xs">ใช้งานล่าสุด</dt>
						<dd className="text-sm">{user.lastSeenAt ? formatRelative(user.lastSeenAt) : "—"}</dd>
					</div>
					<div className="grid gap-0.5">
						<dt className="text-muted-foreground text-xs">สมัครเมื่อ</dt>
						<dd className="text-sm">{formatThaiDate(user.createdAt)}</dd>
					</div>
					<div className="grid gap-0.5">
						<dt className="text-muted-foreground text-xs">ภาษา</dt>
						<dd className="text-sm">{user.locale}</dd>
					</div>
				</dl>
			</Surface>

			<div className="grid gap-4 desktop:grid-cols-2">
				<Surface>
					<SectionTitle title={`ร้านที่สังกัด (${memberships.length})`} />
					{memberships.length === 0 ? (
						<EmptyState title="ยังไม่ได้อยู่ในร้านไหน" />
					) : (
						<MobileListAlways>
							{memberships.map((m) => (
								<MobileRow
									key={m.businessId}
									href={`/businesses/${m.businessId}`}
									title={
										<>
											<span className="truncate">{m.businessName}</span>
											{m.status !== "ACTIVE" ? (
												<StatusBadge tone={m.status === "INVITED" ? "info" : "danger"}>
													{MEMBER_STATUS[m.status] ?? m.status}
												</StatusBadge>
											) : null}
										</>
									}
									meta={`${ROLE_LABEL[m.role] ?? m.role} · เข้าร่วม ${formatThaiDate(m.joinedAt)}`}
									aside={<span className="text-muted-foreground text-xs">{m.plan ? (PLAN_LABEL[m.plan] ?? m.plan) : "—"}</span>}
								/>
							))}
						</MobileListAlways>
					)}
				</Surface>

				<Surface>
					<SectionTitle title={`อุปกรณ์ที่เข้าสู่ระบบอยู่ (${sessions.length})`} hint="นับจาก refresh token ที่ยังไม่หมดอายุ" />
					{sessions.length === 0 ? (
						<EmptyState title="ไม่มีอุปกรณ์ที่เข้าสู่ระบบอยู่" />
					) : (
						<ul className="divide-y">
							{sessions.slice(0, SESSIONS_SHOWN).map((session) => {
								const Icon = isPhone(session.userAgent) ? Smartphone : Monitor;
								return (
									<li key={session.id} className="flex min-h-14 items-center gap-3 px-5 py-3">
										<Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
										<div className="min-w-0 flex-1">
											<p className="truncate font-medium text-sm">{deviceOf(session.userAgent)}</p>
											<p className="truncate text-muted-foreground text-xs">
												เข้าสู่ระบบ {formatDateTime(session.createdAt)} · หมดอายุ {formatThaiDate(session.expiresAt)}
											</p>
										</div>
									</li>
								);
							})}
							{sessions.length > SESSIONS_SHOWN ? (
								<li className="px-5 py-3 text-muted-foreground text-xs">
									และอีก {sessions.length - SESSIONS_SHOWN} อุปกรณ์
								</li>
							) : null}
						</ul>
					)}
				</Surface>
			</div>

			<Surface>
				<SectionTitle title="การเปลี่ยนแปลงโดยผู้ดูแล" />
				<AdminActionsTable rows={actions} showTarget={false} />
			</Surface>
		</div>
	);
}

/** A row list at every width: memberships are few and read better as rows than a table. */
function MobileListAlways({ children }: { children: ReactNode }) {
	return <ul className="divide-y">{children}</ul>;
}

