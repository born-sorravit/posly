"use client";

import { EmptyState } from "@/components/common/primitives";
import { Button } from "@posly/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@posly/ui/components/popover";
import { Skeleton } from "@posly/ui/components/skeleton";
import { useMarkNotificationsRead, useNotifications } from "@/hooks/use-posly";
import { Link } from "@/i18n/navigation";
import type { NotificationDto, NotificationKind } from "@/lib/api/posly";
import { formatRelative, formatThaiDate } from "@posly/utils/format";
import { formatBaht } from "@posly/utils/money";
import { cn } from "@/lib/utils";
import { Ban, Bell, BellOff, ChartNoAxesColumn, CreditCard, Gauge, Megaphone, PackageMinus, PackageX, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

const KIND: Record<NotificationKind, { icon: typeof Bell; tint: string }> = {
	LOW_STOCK: { icon: PackageMinus, tint: "var(--warning)" },
	OUT_OF_STOCK: { icon: PackageX, tint: "var(--danger)" },
	REFUND: { icon: Undo2, tint: "var(--primary)" },
	CANCELLED: { icon: Ban, tint: "var(--danger)" },
	DAILY_SUMMARY: { icon: ChartNoAxesColumn, tint: "var(--success)" },
	ORDER_QUOTA: { icon: Gauge, tint: "var(--warning)" },
	PAYMENT_FAILED: { icon: CreditCard, tint: "var(--danger)" },
	ANNOUNCEMENT: { icon: Megaphone, tint: "var(--primary)" },
};

/** Where a notification leads: the thing it is about. */
const hrefOf = (n: NotificationDto): string => {
	switch (n.kind) {
		case "LOW_STOCK":
		case "OUT_OF_STOCK":
			if (n.data.ingredient) return "/inventory/ingredients";
			return n.entityId ? `/products/${n.entityId}` : "/products";
		case "REFUND":
		case "CANCELLED":
			return n.entityId ? `/orders/${n.entityId}` : "/orders";
		case "DAILY_SUMMARY":
			return "/reports";
		case "ORDER_QUOTA":
		case "PAYMENT_FAILED":
			return "/settings/subscription";
		case "ANNOUNCEMENT":
			return "/notifications";
	}
};

/** The server sends facts; the sentence is written here, in the reader's language. */
function useWording() {
	const t = useTranslations("notifications");
	return (n: NotificationDto): { title: string; body: string } => {
		const d = n.data;
		const num = (key: string) => Number(d[key] ?? 0);
		const str = (key: string) => String(d[key] ?? "");
		switch (n.kind) {
			case "LOW_STOCK":
				return {
					title: t("lowStockTitle"),
					body: t("lowStockBody", { name: str("name"), stock: num("stock"), unit: str("unit") }),
				};
			case "OUT_OF_STOCK":
				return { title: t("outOfStockTitle"), body: t("outOfStockBody", { name: str("name") }) };
			case "REFUND":
			case "CANCELLED": {
				const values = { total: formatBaht(num("total")), actor: str("actor"), reason: str("reason") };
				return {
					title: t(n.kind === "REFUND" ? "refundTitle" : "cancelledTitle", { number: num("number") }),
					body: d.reason ? t("reverseBodyReason", values) : t("reverseBody", values),
				};
			}
			case "DAILY_SUMMARY":
				return {
					title: t("dailyTitle", {
						day: formatThaiDate(`${str("day")}T12:00:00+07:00`, { day: "numeric", month: "short" }),
					}),
					body: t("dailyBody", { revenue: formatBaht(num("revenue")), orders: num("orders") }),
				};
			case "PAYMENT_FAILED":
				return { title: t("paymentFailedTitle"), body: t("paymentFailedBody", { plan: str("plan") }) };
			// Written by the Posly team in the admin monitor, already in Thai.
			case "ANNOUNCEMENT":
				return { title: str("title") || t("announcementTitle"), body: str("body") };
			case "ORDER_QUOTA":
				return d.full
					? { title: t("quotaFullTitle", { limit: num("limit") }), body: t("quotaFullBody") }
					: {
							title: t("quotaNearTitle", { used: num("used"), limit: num("limit") }),
							body: t("quotaNearBody"),
						};
		}
	};
}

export function NotificationList({ limit, onNavigate }: { limit?: number; onNavigate?: () => void }) {
	const t = useTranslations("notifications");
	const notifications = useNotifications();
	const word = useWording();

	if (notifications.isPending) {
		return (
			<div className="grid gap-1 p-1">
				{[0, 1, 2].map((i) => (
					<Skeleton key={i} className="h-14 rounded-xl" />
				))}
			</div>
		);
	}
	if (notifications.isError) {
		return <p className="px-3 py-8 text-center text-muted-foreground text-sm">{t("loadFailed")}</p>;
	}
	const items = (notifications.data?.items ?? []).slice(0, limit);
	if (items.length === 0) {
		return <EmptyState icon={BellOff} title={t("empty")} description={t("emptyHint")} />;
	}

	return (
		<ul className="grid gap-0.5">
			{items.map((n) => {
				const { icon: Icon, tint } = KIND[n.kind];
				const { title, body } = word(n);
				return (
					<li key={n.id}>
						<Link
							href={hrefOf(n)}
							onClick={onNavigate}
							className="flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-muted"
						>
							<span
								className="tint-chip flex size-9 shrink-0 items-center justify-center rounded-lg"
								style={{ "--tint": tint } as React.CSSProperties}
							>
								<Icon className="size-4" />
							</span>
							<span className="min-w-0 flex-1">
								<span className="flex items-center gap-2">
									<span className={cn("truncate text-sm", n.read ? "font-medium" : "font-semibold")}>{title}</span>
									{n.read ? null : (
										<span className="size-1.5 shrink-0 rounded-full bg-primary" aria-label={t("unread")} />
									)}
								</span>
								<span className="line-clamp-2 text-muted-foreground text-xs">{body}</span>
							</span>
							<span className="numeric shrink-0 pt-0.5 text-muted-foreground text-xs" suppressHydrationWarning>
								{formatRelative(n.createdAt)}
							</span>
						</Link>
					</li>
				);
			})}
		</ul>
	);
}

/** "Mark all read", shared by the popover and the phone's notifications page. */
export function MarkAllReadButton() {
	const t = useTranslations("notifications");
	const unread = useNotifications().data?.unread ?? 0;
	const mark = useMarkNotificationsRead();
	return (
		<button
			type="button"
			disabled={unread === 0}
			onClick={() => mark.mutate()}
			className="text-primary text-xs hover:underline disabled:pointer-events-none disabled:text-muted-foreground"
		>
			{t("markAllRead")}
		</button>
	);
}

export function NotificationsButton() {
	const t = useTranslations("notifications");
	const unread = useNotifications().data?.unread ?? 0;
	const [open, setOpen] = useState(false);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="icon-lg"
					className="relative"
					aria-label={unread > 0 ? t("titleUnread", { count: unread }) : t("title")}
				>
					<Bell className="size-5" />
					{unread > 0 ? (
						<span className="numeric absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 font-semibold text-[10px] text-white ring-2 ring-background">
							{unread > 99 ? "99+" : unread}
						</span>
					) : null}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-96 max-w-[calc(100vw-2rem)] p-2">
				<div className="flex items-center justify-between px-2 pt-1 pb-2">
					<p className="font-semibold text-sm">{t("title")}</p>
					<MarkAllReadButton />
				</div>
				<div className="max-h-[min(28rem,70svh)] overflow-y-auto">
					<NotificationList limit={8} onNavigate={() => setOpen(false)} />
				</div>
				<Link
					href="/notifications"
					onClick={() => setOpen(false)}
					className="mt-1 block rounded-lg py-2 text-center text-muted-foreground text-xs hover:bg-muted hover:text-foreground"
				>
					{t("viewAll")}
				</Link>
			</PopoverContent>
		</Popover>
	);
}
