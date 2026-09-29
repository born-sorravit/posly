"use client";

import { useOrderTag } from "@/components/pos/order-tag";
import { ConfirmDialog } from "@/components/common/controls";
import { OrderStatusBadge, PaymentMethodLabel } from "@/components/common/order-badges";
import { PageContainer, SectionTitle, Surface } from "@/components/common/primitives";
import { ProductThumb } from "@/components/common/product-thumb";
import { Button } from "@posly/ui/components/button";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@posly/utils/format";
import { formatBaht } from "@posly/utils/money";
import { EmptyState, TableSkeleton } from "@/components/common/primitives";
import { ReadOnlyNotice } from "@/components/common/permission-gate";
import { usePrintReceipt } from "@/components/receipt/print-receipt";
import { SendReceiptButton } from "@/components/receipt/send-receipt";
import { useOrder, useReverseOrder } from "@/hooks/use-posly";
import { useActiveBusiness } from "@/hooks/use-workspace";
import type { OrderDto } from "@/lib/api/posly";
import { ArrowLeft, Ban, History, Printer, SearchX, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div className="flex items-center justify-between gap-4 py-2 text-sm">
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="text-right font-medium">{value}</dd>
		</div>
	);
}

/**
 * One order (plan §14). Refund and cancel sit behind a confirmation and are recorded in the
 * audit log the API writes — shown here so the owner sees who did what.
 */
export function OrderDetailPage({ orderId }: { orderId: string }) {
	const t = useTranslations("orders");
	const order = useOrder(orderId);
	if (order.isPending) {
		return (
			<PageContainer className="max-w-5xl">
				<TableSkeleton />
			</PageContainer>
		);
	}
	if (!order.data) {
		return (
			<PageContainer>
				<EmptyState icon={SearchX} title={t("notFound")} />
			</PageContainer>
		);
	}
	return <OrderDetail order={order.data} />;
}

export function OrderDetail({ order }: { order: OrderDto }) {
	const t = useTranslations("orders");
	const tagOf = useOrderTag();
	const tAudit = useTranslations("audit");
	const { can } = useActiveBusiness();
	const reverse = useReverseOrder();
	const { print, portal } = usePrintReceipt();
	const [confirm, setConfirm] = useState<"refund" | "cancel" | null>(null);
	const [reason, setReason] = useState("");
	const canReverse = order.status === "PAID";

	return (
		<PageContainer className="max-w-5xl">
			<div className="flex flex-col gap-4 tablet:flex-row tablet:items-center tablet:justify-between">
				<div className="flex items-center gap-3">
					<Button asChild variant="ghost" size="icon-lg" aria-label={t("back")}>
						<Link href="/orders">
							<ArrowLeft />
						</Link>
					</Button>
					<div>
						<h1 className="numeric flex items-center gap-3 font-semibold text-2xl tracking-tight">
							#{order.number}
							<OrderStatusBadge status={order.status} />
						</h1>
						<p className="text-muted-foreground text-sm">
							{formatDateTime(order.createdAt)}
							{tagOf(order) ? <span className="ml-2 font-medium text-foreground">· {tagOf(order)}</span> : null}
						</p>
					</div>
				</div>
				<div className="flex flex-wrap gap-2">
					<SendReceiptButton orderId={order.id} size="lg" />
					<Button variant="outline" size="lg" onClick={() => print(order)}>
						<Printer />
						{t("print")}
					</Button>
					<Button variant="outline" size="lg" disabled={!canReverse || !can("orders:refund")} onClick={() => setConfirm("refund")}>
						<Undo2 />
						{t("refund")}
					</Button>
					<Button
						variant="outline"
						size="lg"
						disabled={!canReverse || !can("orders:cancel")}
						className="text-danger hover:text-danger"
						onClick={() => setConfirm("cancel")}
					>
						<Ban />
						{t("cancel")}
					</Button>
				</div>
			</div>

			{canReverse && (!can("orders:refund") || !can("orders:cancel")) ? (
				<ReadOnlyNotice permission="orders:refund" />
			) : null}

			<div className="grid gap-4 desktop:grid-cols-3">
				<Surface className="desktop:col-span-2">
					<SectionTitle>{t("items")}</SectionTitle>
					<ul className="divide-y">
						{order.items.map((item) => (
							<li key={item.id} className="flex items-center gap-3 py-3">
								<ProductThumb art={item.art} name={item.name} className="size-11" rounded="rounded-lg" />
								<div className="min-w-0 flex-1">
									<p className="font-medium text-sm">{item.name}</p>
									<p className="text-muted-foreground text-xs">
										{[...item.modifiers.map((m) => m.optionName), item.note].filter(Boolean).join(" · ") ||
											formatBaht(item.unitPrice)}
									</p>
								</div>
								<span className="numeric text-muted-foreground text-sm">×{item.quantity}</span>
								<span className="numeric w-20 text-right font-medium text-sm">{formatBaht(item.lineTotal)}</span>
							</li>
						))}
					</ul>
					<dl className="numeric mt-2 border-t pt-2">
						<Row label={t("subtotal")} value={formatBaht(order.subtotal)} />
						{order.discount > 0 ? <Row label={t("discount")} value={formatBaht(-order.discount)} /> : null}
						<Row label={t("vat")} value={formatBaht(order.vat)} />
						<div className="flex items-baseline justify-between pt-2">
							<dt className="font-semibold">{t("total")}</dt>
							<dd className="font-bold text-2xl">{formatBaht(order.total)}</dd>
						</div>
					</dl>
				</Surface>

				<div className="grid content-start gap-4">
					<Surface>
						<SectionTitle>{t("payment")}</SectionTitle>
						<dl className="divide-y">
							<Row label={t("method")} value={<PaymentMethodLabel method={order.paymentMethod} />} />
							{order.received !== null ? (
								<Row label={t("received")} value={<span className="numeric">{formatBaht(order.received)}</span>} />
							) : null}
							{order.change !== null ? (
								<Row label={t("change")} value={<span className="numeric">{formatBaht(order.change)}</span>} />
							) : null}
							<Row label={t("employee")} value={order.employeeName} />
							<Row label={t("customer")} value={order.customerName ?? "—"} />
						</dl>
					</Surface>
					<Surface>
						<SectionTitle>{t("auditLog")}</SectionTitle>
						<ol className="space-y-3 text-sm">
							<li className="flex gap-3">
								<History className="mt-0.5 size-4 text-muted-foreground" />
								<span>
									<span className="font-medium">{order.employeeName}</span> {t("auditCreated")}
									<span className="block text-muted-foreground text-xs">{formatDateTime(order.createdAt)}</span>
								</span>
							</li>
							{order.audit.map((entry) => (
								<li key={entry.createdAt + entry.action} className="flex gap-3">
									<Undo2 className="mt-0.5 size-4 text-danger" />
									<span>
										<span className="font-medium">{entry.actorName}</span>{" "}
										{tAudit(entry.action as "ORDER_REFUNDED")}
										{entry.reason ? <span className="block text-sm">“{entry.reason}”</span> : null}
										<span className="block text-muted-foreground text-xs">{formatDateTime(entry.createdAt)}</span>
									</span>
								</li>
							))}
						</ol>
					</Surface>
				</div>
			</div>

			{portal}
			<ConfirmDialog
				open={confirm !== null}
				onOpenChange={(open) => !open && setConfirm(null)}
				title={confirm === "refund" ? t("refundTitle") : t("cancelTitle")}
				description={t("reverseHint", { number: order.number })}
				confirmLabel={confirm === "refund" ? t("refund") : t("cancel")}
				cancelLabel={t("keep")}
				destructive
				icon={confirm === "cancel" ? Ban : Undo2}
				onConfirm={() => {
					if (!confirm) return;
					reverse.mutate(
						{ orderId: order.id, kind: confirm, reason: reason.trim() || undefined },
						{
							onSuccess: () => toast.success(confirm === "refund" ? t("refunded") : t("cancelled")),
							onError: (error) => toast.error(error.message),
						}
					);
					setReason("");
				}}
			>
				<input
					maxLength={300}
					value={reason}
					onChange={(event) => setReason(event.target.value)}
					placeholder={t("reasonPlaceholder")}
					className="h-11 w-full rounded-xl border bg-card px-3 text-sm outline-none focus:border-primary/50"
				/>
			</ConfirmDialog>
		</PageContainer>
	);
}
