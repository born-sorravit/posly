"use client";

import { StatusBadge } from "@/components/common/primitives";
import type { OrderStatus, PaymentMethod, StockStatus, Tone } from "@posly/types/domain";
import { Banknote, CreditCard, type LucideIcon, QrCode, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";

const ORDER_TONE: Record<OrderStatus, Tone | "neutral"> = {
	DRAFT: "neutral",
	PENDING_PAYMENT: "warning",
	PAID: "success",
	CANCELLED: "neutral",
	REFUNDED: "danger",
	PARTIALLY_REFUNDED: "warning",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
	const t = useTranslations("orderStatus");
	return (
		<StatusBadge tone={ORDER_TONE[status]} dot>
			{t(status)}
		</StatusBadge>
	);
}

export const PAYMENT_ICON: Record<PaymentMethod, LucideIcon> = {
	CASH: Banknote,
	PROMPTPAY: QrCode,
	CARD: CreditCard,
	OTHER: Wallet,
};

export function PaymentMethodLabel({ method }: { method: PaymentMethod }) {
	const t = useTranslations("paymentMethod");
	const Icon = PAYMENT_ICON[method];
	return (
		<span className="inline-flex items-center gap-1.5 text-sm">
			<Icon className="size-4 text-muted-foreground" />
			{t(method)}
		</span>
	);
}

const STOCK_TONE: Record<StockStatus, Tone | "neutral"> = {
	IN_STOCK: "success",
	LOW_STOCK: "warning",
	OUT_OF_STOCK: "danger",
	UNTRACKED: "neutral",
};

export function StockBadge({ status }: { status: StockStatus }) {
	const t = useTranslations("stockStatus");
	return <StatusBadge tone={STOCK_TONE[status]}>{t(status)}</StatusBadge>;
}
