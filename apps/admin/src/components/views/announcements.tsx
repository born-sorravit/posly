"use client";

import {
	EmptyState,
	ErrorState,
	Pager,
	PageHeader,
	RowsSkeleton,
	SectionTitle,
	StatusBadge,
	Surface,
} from "@/components/common/primitives";
import { usePageFor } from "@/hooks/use-page-for";
import { useAdmin, useAdminAction, useAdminPage } from "@/lib/admin-api";
import { PLAN_LABEL } from "@/lib/labels";
import type { AdminActionRow } from "@/lib/types";
import { Button } from "@posly/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@posly/ui/components/dialog";
import { Input } from "@posly/ui/components/input";
import { Label } from "@posly/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@posly/ui/components/select";
import { Switch } from "@posly/ui/components/switch";
import { Textarea } from "@posly/ui/components/textarea";
import { formatDateTime, formatNumber } from "@posly/utils/format";
import { LoaderCircle, Megaphone, Send } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

const TITLE_MAX = 80;
const BODY_MAX = 500;

/** How the message will look in a shop's bell (apps/web's notification row). */
function Preview({ title, body }: { title: string; body: string }) {
	return (
		<div className="rounded-2xl border border-dashed p-3">
			<p className="mb-2 px-1 font-medium text-muted-foreground text-xs">ตัวอย่างในกระดิ่งแจ้งเตือนของร้าน</p>
			<div className="flex gap-3 rounded-xl bg-card p-3 shadow-xs">
				<span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
					<Megaphone className="size-4" />
				</span>
				<div className="min-w-0 flex-1">
					<p className="font-medium text-sm">{title.trim() || "ประกาศจาก Posly"}</p>
					<p className="whitespace-pre-wrap break-words text-muted-foreground text-xs">
						{body.trim() || "ข้อความที่ร้านจะเห็น"}
					</p>
					<p className="mt-1 text-muted-foreground/80 text-[11px]">เมื่อสักครู่</p>
				</div>
			</div>
		</div>
	);
}

export function AnnouncementsView() {
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [plan, setPlan] = useState("all");
	const [includeDemo, setIncludeDemo] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const [page, setPage] = usePageFor("history");

	// A select and a switch change in single steps: no debounce needed.
	const audience = useAdmin<{ shops: number }>(
		"announcements/audience",
		{ plan: plan === "all" ? null : plan, includeDemo },
		0
	);
	const history = useAdminPage<AdminActionRow>("announcements", { page, limit: 10 }, 0);
	const send = useAdminAction<
		{ title: string; body: string; plan?: string; includeDemo: boolean },
		{ sent: number }
	>("announcements");

	const shops = audience.data?.shops ?? 0;
	const ready = title.trim().length > 0 && body.trim().length > 0 && shops > 0;

	const submit = (event: FormEvent) => {
		event.preventDefault();
		if (ready) setConfirming(true);
	};

	const confirm = () =>
		send.mutate(
			{ title, body, plan: plan === "all" ? undefined : plan, includeDemo },
			{
				onSuccess: ({ sent }) => {
					toast.success(`ส่งประกาศถึง ${formatNumber(sent)} ร้านแล้ว`);
					setConfirming(false);
					setTitle("");
					setBody("");
				},
				onError: (error) => toast.error(error.message),
			}
		);

	return (
		<div className="grid gap-6">
			<PageHeader title="ประกาศ" description="ส่งข้อความเข้ากระดิ่งแจ้งเตือนของทุกคนในร้าน เช่น ปิดปรับปรุงระบบ หรือฟีเจอร์ใหม่" />

			<div className="grid gap-4 desktop:grid-cols-[1fr_380px]">
				<Surface>
					<SectionTitle title="ประกาศใหม่" />
					<form onSubmit={submit} className="grid gap-4 px-5 pb-5">
						<div className="grid gap-2">
							<Label htmlFor="announcement-title">หัวข้อ</Label>
							<Input
								id="announcement-title"
								value={title}
								maxLength={TITLE_MAX}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="เช่น ปิดปรับปรุงระบบคืนวันเสาร์"
								className="h-11"
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="announcement-body">ข้อความ</Label>
							<Textarea
								id="announcement-body"
								value={body}
								maxLength={BODY_MAX}
								onChange={(e) => setBody(e.target.value)}
								placeholder="ระบบจะปิดปรับปรุงคืนวันเสาร์ เวลา 02:00–03:00 น."
								className="min-h-28 rounded-xl"
							/>
							<p className="numeric text-right text-muted-foreground text-xs">
								{body.length}/{BODY_MAX}
							</p>
						</div>
						<div className="grid gap-4 tablet:grid-cols-2">
							<div className="grid gap-2">
								<Label htmlFor="announcement-plan">ส่งถึง</Label>
								<Select value={plan} onValueChange={setPlan}>
									<SelectTrigger id="announcement-plan" className="w-full data-[size=default]:h-11">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">ทุกร้าน</SelectItem>
										{Object.entries(PLAN_LABEL).map(([code, label]) => (
											<SelectItem key={code} value={code}>
												เฉพาะแพ็กเกจ {label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="flex items-end gap-2 pb-2.5">
								<Switch id="announcement-demo" checked={includeDemo} onCheckedChange={setIncludeDemo} />
								<Label htmlFor="announcement-demo" className="text-muted-foreground text-sm">
									รวมร้าน demo
								</Label>
							</div>
						</div>
						<div className="flex flex-col gap-3 border-t pt-4 tablet:flex-row tablet:items-center tablet:justify-between">
							<p className="text-muted-foreground text-sm">
								{audience.isFetching && !audience.data ? (
									"กำลังนับร้าน…"
								) : (
									<>
										จะส่งถึง <span className="numeric font-semibold text-foreground">{formatNumber(shops)}</span> ร้าน
									</>
								)}
							</p>
							<Button type="submit" size="lg" className="brand-gradient h-11 w-full tablet:h-9 tablet:w-auto" disabled={!ready}>
								<Send />
								ส่งประกาศ
							</Button>
						</div>
					</form>
				</Surface>

				<Preview title={title} body={body} />
			</div>

			<Surface>
				<SectionTitle title="ประกาศที่ส่งแล้ว" />
				{history.error && !history.data ? (
					<ErrorState error={history.error} retry={() => history.refetch()} />
				) : !history.data ? (
					<RowsSkeleton rows={3} />
				) : history.data.data.length === 0 ? (
					<EmptyState icon={Megaphone} title="ยังไม่เคยส่งประกาศ" />
				) : (
					<>
						<ul className="divide-y border-t">
							{history.data.data.map((row) => {
								const p = row.payload as { title?: string; body?: string; plan?: string | null; shops?: number };
								return (
									<li key={row.id} className="flex flex-col gap-1 px-5 py-3 tablet:flex-row tablet:items-start tablet:gap-4">
										<div className="min-w-0 flex-1">
											<p className="font-medium text-sm">{p.title}</p>
											<p className="whitespace-pre-wrap break-words text-muted-foreground text-xs">{p.body}</p>
										</div>
										<div className="flex shrink-0 flex-wrap items-center gap-2 text-muted-foreground text-xs tablet:justify-end">
											<StatusBadge tone="info">{p.plan ? `แพ็กเกจ ${PLAN_LABEL[p.plan] ?? p.plan}` : "ทุกร้าน"}</StatusBadge>
											<span className="numeric">{formatNumber(p.shops ?? 0)} ร้าน</span>
											<span>
												{row.adminEmail} · {formatDateTime(row.createdAt)}
											</span>
										</div>
									</li>
								);
							})}
						</ul>
						{history.data.meta.last_page > 1 ? (
							<Pager page={history.data.meta.page} lastPage={history.data.meta.last_page} total={history.data.meta.total} onPage={setPage} />
						) : null}
					</>
				)}
			</Surface>

			<Dialog open={confirming} onOpenChange={setConfirming}>
				<DialogContent className="gap-6 p-6 sm:max-w-md">
					<DialogHeader>
						<DialogTitle>ส่งประกาศถึง {formatNumber(shops)} ร้าน?</DialogTitle>
						<DialogDescription>
							ทุกคนในร้านที่ได้รับจะเห็นในกระดิ่งแจ้งเตือนทันที ส่งแล้วยกเลิกไม่ได้
						</DialogDescription>
					</DialogHeader>
					<Preview title={title} body={body} />
					<DialogFooter>
						<Button variant="outline" size="lg" className="h-11 tablet:h-9" onClick={() => setConfirming(false)}>
							ยกเลิก
						</Button>
						<Button size="lg" className="brand-gradient h-11 tablet:h-9" disabled={send.isPending} onClick={confirm}>
							{send.isPending ? <LoaderCircle className="animate-spin" /> : <Send />}
							ส่งเลย
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
