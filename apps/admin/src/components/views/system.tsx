"use client";

import { ErrorState, PageHeader, SectionTitle, StatusBadge, Surface } from "@/components/common/primitives";
import { useAdmin } from "@/lib/admin-api";
import type { AdminSystemResponse } from "@/lib/types";
import { Skeleton } from "@posly/ui/components/skeleton";
import { formatClock, formatNumber } from "@posly/utils/format";
import { CheckCircle2, CircleSlash, XCircle } from "lucide-react";
import type { ReactNode } from "react";

const uptime = (seconds: number) => {
	const d = Math.floor(seconds / 86_400);
	const h = Math.floor((seconds % 86_400) / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	return [d && `${d} วัน`, h && `${h} ชม.`, `${m} นาที`].filter(Boolean).join(" ");
};

/** Up / down / not configured, each with its own icon and word — never colour alone. */
function Health({ state }: { state: "up" | "down" | "off" }) {
	if (state === "up")
		return (
			<span className="flex items-center gap-1.5 font-medium text-success text-sm">
				<CheckCircle2 className="size-4" /> ปกติ
			</span>
		);
	if (state === "down")
		return (
			<span className="flex items-center gap-1.5 font-medium text-destructive text-sm">
				<XCircle className="size-4" /> ล่ม
			</span>
		);
	return (
		<span className="flex items-center gap-1.5 text-muted-foreground text-sm">
			<CircleSlash className="size-4" /> ไม่ได้ตั้งค่า
		</span>
	);
}

function Row({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex items-center justify-between gap-4 border-t py-2.5 text-sm first:border-t-0">
			<span className="text-muted-foreground">{label}</span>
			<span className="numeric text-right">{children}</span>
		</div>
	);
}

/** What each key family under the app's prefix holds (see apps/api/src/shared/cache/cache-keys.ts). */
const CACHE_KIND: Record<string, string> = {
	dashboard: "Dashboard ของร้าน (5 นาที)",
	subscription: "แพ็กเกจของร้าน (1 นาที)",
	v: "ตัวนับ version ของ dashboard",
	admin: "ภาพรวมของ admin (1 นาที)",
};

function CacheCard({ data }: { data: AdminSystemResponse }) {
	const stats = data.cacheStats;
	const server = stats?.server;
	const lookups = server && server.hits !== null && server.misses !== null ? server.hits + server.misses : null;
	const hitRate = lookups ? (server?.hits ?? 0) / lookups : null;
	const kinds = Object.entries(stats?.keys.byKind ?? {}).sort((a, b) => b[1] - a[1]);

	return (
		<Surface>
			<SectionTitle
				title="Cache"
				hint={
					stats?.provider === "redis"
						? "นับเฉพาะ key ของแอปนี้ ส่วนตัวเลขของเซิร์ฟเวอร์รวมทุกโปรแกรมที่ใช้ Redis ตัวนี้"
						: "ไม่ได้ตั้ง REDIS_URL จึงเก็บในหน่วยความจำของ API แต่ละตัว"
				}
			/>
			{!stats ? (
				<p className="px-5 pb-5 text-muted-foreground text-sm">อ่านสถานะ cache ไม่ได้ (Redis อาจเชื่อมต่อไม่ได้)</p>
			) : (
				<div className="grid gap-x-8 px-5 pb-4 desktop:grid-cols-2">
					<div>
						<Row label="Key ทั้งหมด">
							{formatNumber(stats.keys.total)}
							{stats.keys.truncated ? "+" : ""}
						</Row>
						{kinds.length === 0 ? (
							<Row label="ตอนนี้">ยังไม่มีข้อมูลใน cache</Row>
						) : (
							kinds.map(([kind, count]) => (
								<Row key={kind} label={CACHE_KIND[kind] ?? kind}>
									{formatNumber(count)}
								</Row>
							))
						)}
					</div>
					{server ? (
						<div>
							<Row label="Hit rate">
								{hitRate === null ? "—" : `${(hitRate * 100).toFixed(1)}%`}
								{lookups ? (
									<span className="ml-1 text-muted-foreground text-xs">
										({formatNumber(server.hits ?? 0)} / {formatNumber(lookups)})
									</span>
								) : null}
							</Row>
							<Row label="Memory">
								{server.usedMemoryMb ?? "—"} MB
								{server.maxMemoryMb ? ` / ${server.maxMemoryMb} MB` : ""}
							</Row>
							<Row label="Key ที่ถูกไล่ออก (evicted)">{formatNumber(server.evictedKeys ?? 0)}</Row>
							<Row label="Redis">
								{server.version ?? "—"}
								{server.uptimeSeconds !== null ? ` · ${uptime(server.uptimeSeconds)}` : ""}
							</Row>
						</div>
					) : null}
				</div>
			)}
		</Surface>
	);
}

export function SystemView() {
	const { data, error, isLoading, refetch, dataUpdatedAt } = useAdmin<AdminSystemResponse>("system", undefined, 15_000);

	return (
		<div className="grid gap-6">
			<PageHeader
				title="สถานะระบบ"
				description={data ? `ตรวจล่าสุด ${formatClock(new Date(dataUpdatedAt))} · อัปเดตทุก 15 วินาที` : "อัปเดตทุก 15 วินาที"}
			/>

			{error && !data ? (
				<Surface>
					<ErrorState error={error} retry={() => refetch()} />
				</Surface>
			) : isLoading || !data ? (
				<div className="grid gap-4 desktop:grid-cols-3">
					{Array.from({ length: 3 }, (_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
						<Skeleton key={i} className="h-56 rounded-2xl" />
					))}
				</div>
			) : (
				<>
					<div className="grid gap-4 desktop:grid-cols-3">
						<Surface>
							<SectionTitle title="API" action={<Health state="up" />} />
							<div className="px-5 pb-4">
								<Row label="Environment">{data.api.env}</Row>
								<Row label="Node">{data.api.node}</Row>
								<Row label="Uptime">{uptime(data.api.uptimeSeconds)}</Row>
								<Row label="Memory (RSS)">{data.api.memory.rssMb} MB</Row>
								<Row label="Heap">
									{data.api.memory.heapUsedMb} / {data.api.memory.heapTotalMb} MB
								</Row>
								<Row label="Timezone">{data.api.timezone}</Row>
							</div>
						</Surface>

						<Surface>
							<SectionTitle title="Database" action={<Health state={data.database.up ? "up" : "down"} />} />
							<div className="px-5 pb-4">
								<Row label="Latency">{data.database.latencyMs != null ? `${data.database.latencyMs} ms` : "—"}</Row>
								<Row label="ขนาด">{data.database.sizeMb != null ? `${data.database.sizeMb} MB` : "—"}</Row>
								<Row label="Connections">{data.database.connections ?? "—"}</Row>
								<Row label="Migrations">{formatNumber(data.database.migrations.applied)}</Row>
								<Row label="ล่าสุด">
									<span className="text-xs">{data.database.migrations.last ?? "—"}</span>
								</Row>
								<Row label="ค้างรัน">
									{data.database.migrations.pending == null ? (
										"—"
									) : data.database.migrations.pending ? (
										<StatusBadge tone="warning">มี migration ค้าง</StatusBadge>
									) : (
										<StatusBadge tone="success">ไม่มี</StatusBadge>
									)}
								</Row>
							</div>
						</Surface>

						<Surface>
							<SectionTitle
								title={`Cache (${data.cache.provider === "redis" ? "Redis" : "in-memory"})`}
								action={<Health state={data.cache.up ? "up" : "down"} />}
							/>
							<div className="px-5 pb-4">
								<Row label="Latency">{data.cache.latencyMs != null ? `${data.cache.latencyMs} ms` : "—"}</Row>
							</div>
							<SectionTitle title="Integrations" />
							<div className="px-5 pb-4">
								<Row label="Stripe"><Health state={data.integrations.stripe ? "up" : "off"} /></Row>
								<Row label="Stripe webhook"><Health state={data.integrations.stripeWebhook ? "up" : "off"} /></Row>
								<Row label="อีเมล (Resend)"><Health state={data.integrations.mail ? "up" : "off"} /></Row>
								<Row label="Storage (S3/R2)"><Health state={data.integrations.storage ? "up" : "off"} /></Row>
								<Row label="Google sign-in"><Health state={data.integrations.googleSignIn ? "up" : "off"} /></Row>
								<Row label="Demo"><Health state={data.integrations.demo ? "up" : "off"} /></Row>
							</div>
						</Surface>
					</div>

					<CacheCard data={data} />

					<Surface>
						<SectionTitle title="ตาราง" hint="จำนวนแถวโดยประมาณจาก pg_stat_user_tables" />
						<div className="grid gap-x-8 px-5 pb-4 sm:grid-cols-2 desktop:grid-cols-3">
							{data.database.tables.map((t) => (
								<Row key={t.name} label={t.name}>
									{formatNumber(t.rows)}
								</Row>
							))}
						</div>
					</Surface>
				</>
			)}
		</div>
	);
}
