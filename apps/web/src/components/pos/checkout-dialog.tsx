"use client";

import { PAYMENT_ICON } from "@/components/common/order-badges";
import { Button } from "@posly/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@posly/ui/components/dialog";
import { formatBaht, fromBaht, quickCashAmounts, type Satang } from "@posly/utils/money";
import { promptPayPayload } from "@posly/utils/promptpay";
import { cn } from "@/lib/utils";
import type { CartTotals } from "@/stores/cart-store";
import type { OrderDto } from "@/lib/api/posly";
import { Receipt } from "@/components/receipt/receipt";
import { usePrintReceipt } from "@/components/receipt/print-receipt";
import { useActiveBusiness } from "@/hooks/use-workspace";
import type { PaymentMethod } from "@posly/types/domain";
import { Check, Delete, Printer, ShoppingCart } from "lucide-react";
import { SendReceiptButton } from "@/components/receipt/send-receipt";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export interface CompletedPayment {
	/** The order exactly as the API stored it — what the receipt prints. */
	order: OrderDto;
	method: PaymentMethod;
	total: Satang;
	received: Satang | null;
	change: Satang | null;
	orderNumber: string;
}

const METHODS: PaymentMethod[] = ["CASH", "PROMPTPAY", "CARD", "OTHER"];

function MethodCard({
	method,
	selected,
	onSelect,
}: {
	method: PaymentMethod;
	selected: boolean;
	onSelect: () => void;
}) {
	const t = useTranslations("paymentMethod");
	const Icon = PAYMENT_ICON[method];
	return (
		<button
			type="button"
			role="radio"
			aria-checked={selected}
			onClick={onSelect}
			className={cn(
				"touch-target flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl font-medium text-sm ring-1 transition-colors",
				selected
					? "bg-primary text-primary-foreground shadow-md ring-primary"
					: "bg-card text-foreground ring-border hover:bg-muted"
			)}
		>
			<Icon className="size-5" />
			{t(method)}
		</button>
	);
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"] as const;

/** Cash: quick amounts first (one tap for most customers), a keypad for the rest. */
function CashPane({
	total,
	onConfirm,
}: {
	total: Satang;
	onConfirm: (received: Satang) => void;
}) {
	const t = useTranslations("checkout");
	const [typed, setTyped] = useState("");
	const quick = quickCashAmounts(total);
	const received = typed ? fromBaht(Number.parseFloat(typed) || 0) : total;
	const change = received - total;
	const enough = received >= total;

	const press = (key: (typeof KEYS)[number]) =>
		setTyped((current) => {
			if (key === "del") return current.slice(0, -1);
			if (key === "." && current.includes(".")) return current;
			if (current.includes(".") && current.split(".")[1].length >= 2) return current;
			return (current + key).replace(/^0+(?=\d)/, "");
		});

	return (
		<div className="flex h-full flex-col gap-4">
			<div>
				<p className="mb-2 font-medium text-muted-foreground text-sm">{t("receivedAmount")}</p>
				<div className="grid grid-cols-2 gap-2 tablet:grid-cols-4">
					{quick.map((amount) => {
						const active = typed === "" ? amount === total : received === amount;
						return (
							<button
								key={amount}
								type="button"
								onClick={() => setTyped(String(amount / 100))}
								className={cn(
									"touch-target numeric h-12 rounded-xl font-semibold ring-1 transition-colors",
									active ? "bg-accent text-accent-foreground ring-primary" : "bg-card ring-border hover:bg-muted"
								)}
							>
								{formatBaht(amount)}
							</button>
						);
					})}
				</div>
			</div>

			<div className="grid flex-1 grid-cols-[1fr_auto] gap-4">
				<div className="grid grid-cols-3 gap-2">
					{KEYS.map((key) => (
						<button
							key={key}
							type="button"
							onClick={() => press(key)}
							aria-label={key === "del" ? t("delete") : key}
							className="touch-target numeric flex h-12 items-center justify-center rounded-xl bg-muted font-semibold text-lg transition-colors hover:bg-accent active:scale-95"
						>
							{key === "del" ? <Delete className="size-5" /> : key}
						</button>
					))}
				</div>
				<div className="flex w-36 flex-col justify-between gap-3 rounded-2xl bg-muted/60 p-4 tablet:w-44">
					<div>
						<p className="text-muted-foreground text-xs">{t("receivedAmount")}</p>
						<p className="numeric font-semibold text-xl">{formatBaht(received)}</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">{t("change")}</p>
						<p className={cn("numeric font-bold text-3xl tracking-tight", enough ? "text-success" : "text-danger")}>
							{formatBaht(change)}
						</p>
					</div>
				</div>
			</div>

			<Button
				disabled={!enough}
				onClick={() => onConfirm(received)}
				className="brand-gradient h-14 w-full rounded-2xl font-semibold text-base"
			>
				<Check className="size-5" />
				{t("confirm")}
			</Button>
		</div>
	);
}

/**
 * PromptPay: a dynamic QR carrying the exact amount (plan §12). Phase 1 has the cashier
 * confirm by hand; the 5-minute timer is what a gateway's expiry will replace.
 */
function PromptPayPane({
	total,
	promptPayId,
	onConfirm,
}: {
	total: Satang;
	promptPayId: string | null;
	onConfirm: () => void;
}) {
	const t = useTranslations("checkout");
	const [secondsLeft, setSecondsLeft] = useState(300);

	useEffect(() => {
		const id = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
		return () => window.clearInterval(id);
	}, []);

	if (!promptPayId) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-2 text-center">
				<p className="font-medium">{t("promptPayMissing")}</p>
				<p className="text-muted-foreground text-sm">{t("promptPayMissingHint")}</p>
			</div>
		);
	}

	const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
	const ss = String(secondsLeft % 60).padStart(2, "0");

	return (
		<div className="flex h-full flex-col items-center gap-4">
			<div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
				<p className="flex items-center gap-2 font-semibold text-[#0f3d68] text-sm">
					<span className="rounded bg-[#0f3d68] px-1.5 py-0.5 font-bold text-[10px] text-white">
						PromptPay
					</span>
					{t("scanToPay")}
				</p>
				<QRCodeSVG
					value={promptPayPayload(promptPayId, total)}
					size={208}
					level="M"
					marginSize={0}
					className="h-auto w-full max-w-52"
				/>
				<p className="numeric font-bold text-2xl text-[#111827]">{formatBaht(total)}</p>
				<p className="numeric text-[#64748b] text-xs">
					{t("expiresIn")} {mm}:{ss}
				</p>
			</div>
			<p className="text-center text-muted-foreground text-sm">{t("promptPayHint")}</p>
			<Button
				onClick={onConfirm}
				className="mt-auto h-14 w-full rounded-2xl bg-success font-semibold text-base text-success-foreground hover:bg-success/90"
			>
				<Check className="size-5" />
				{t("received")}
			</Button>
		</div>
	);
}

function SimplePane({ onConfirm, method }: { onConfirm: () => void; method: PaymentMethod }) {
	const t = useTranslations("checkout");
	const tMethod = useTranslations("paymentMethod");
	const Icon = PAYMENT_ICON[method];
	return (
		<div className="flex h-full flex-col items-center justify-center gap-4 text-center">
			<span className="flex size-16 items-center justify-center rounded-2xl bg-accent text-primary">
				<Icon className="size-7" />
			</span>
			<p className="max-w-xs text-muted-foreground text-sm">
				{t("manualHint", { method: tMethod(method) })}
			</p>
			<Button onClick={onConfirm} className="brand-gradient mt-auto h-14 w-full rounded-2xl font-semibold text-base">
				<Check className="size-5" />
				{t("confirm")}
			</Button>
		</div>
	);
}

/**
 * The success screen (plan §13): the change to hand back first (what the cashier needs this
 * second), then the order number, and the receipt exactly as it will print beside it.
 * "New order" is the primary action and takes focus, so Enter starts the next sale.
 */
function SuccessPane({ payment, onNewOrder }: { payment: CompletedPayment; onNewOrder: () => void }) {
	const t = useTranslations("checkout");
	const tMethod = useTranslations("paymentMethod");
	const { business } = useActiveBusiness();
	const { print, portal } = usePrintReceipt();
	const hasChange = payment.change !== null && payment.change > 0;

	return (
		<div className="grid tablet:grid-cols-[1fr_300px]">
			<div className="flex flex-col items-center gap-6 px-6 py-10 text-center">
				<div className="relative">
					<motion.span
						aria-hidden
						initial={{ scale: 0.6, opacity: 0.6 }}
						animate={{ scale: 1.6, opacity: 0 }}
						transition={{ duration: 0.9, ease: "easeOut" }}
						className="absolute inset-0 rounded-full bg-success"
					/>
					<motion.span
						initial={{ scale: 0.4, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						transition={{ type: "spring", stiffness: 420, damping: 22 }}
						className="relative flex size-20 items-center justify-center rounded-full bg-success text-white shadow-lg"
					>
						<Check className="size-10" strokeWidth={3} />
					</motion.span>
				</div>

				<div className="space-y-1">
					<p className="font-semibold text-lg">{t("success")}</p>
					<p className="numeric text-muted-foreground text-sm">
						#{payment.orderNumber} · {tMethod(payment.method)}
					</p>
				</div>

				<div className="grid w-full max-w-sm grid-cols-2 gap-2">
					<div className={cn("rounded-2xl bg-muted/60 p-4 text-left", !hasChange && "col-span-2 text-center")}>
						<p className="text-muted-foreground text-xs">{t("paidTotal")}</p>
						<p className="numeric font-bold text-2xl tracking-tight">{formatBaht(payment.total)}</p>
					</div>
					{hasChange ? (
						<div className="rounded-2xl bg-success/10 p-4 text-left ring-1 ring-success/30">
							<p className="text-success text-xs">{t("changeDue")}</p>
							<p className="numeric font-bold text-2xl text-success tracking-tight">
								{formatBaht(payment.change as number)}
							</p>
						</div>
					) : null}
				</div>

				<div className="grid w-full max-w-sm gap-2">
					<Button
						// biome-ignore lint/a11y/noAutofocus: the next order should start with one keypress
						autoFocus
						onClick={onNewOrder}
						className="brand-gradient h-14 rounded-2xl font-semibold text-base"
					>
						<ShoppingCart className="size-5" />
						{t("newOrder")}
					</Button>
					<div className="grid grid-cols-2 gap-2">
						<Button variant="outline" className="h-12 rounded-xl" onClick={() => print(payment.order)}>
							<Printer />
							{t("print")}
						</Button>
						<SendReceiptButton orderId={payment.order.id} className="h-12 rounded-xl" />
					</div>
				</div>
			</div>

			{/* The receipt as it will print, from tablet up. */}
			<aside className="hidden border-l bg-muted/40 p-5 tablet:block">
				<p className="mb-3 font-medium text-muted-foreground text-xs">{t("receiptPreview")}</p>
				<div className="max-h-[440px] overflow-y-auto rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/5">
					<Receipt business={business} order={payment.order} className="w-full" />
				</div>
			</aside>
			{portal}
		</div>
	);
}

/**
 * Checkout, as one large modal (plan §11): the amount stays pinned on the left while the
 * method pane on the right changes. On a phone it stacks.
 *
 * `onPay` goes to the API, which reprices the order; the success screen shows the **server's**
 * number and total, not the cart's. `sessionKey` is the order's clientOrderId — one per
 * checkout session, so a retry after a timeout replays the same order instead of charging
 * twice.
 */
export function CheckoutDialog(props: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	totals: CartTotals;
	sessionKey: string;
	promptPayId: string | null;
	onPay: (method: PaymentMethod, received: Satang | null) => Promise<CompletedPayment>;
	onNewOrder: () => void;
}) {
	// Keyed per order: a fresh method choice and no stale success screen, without an effect.
	return <CheckoutSession key={props.sessionKey} {...props} />;
}

function CheckoutSession({
	open,
	onOpenChange,
	totals,
	promptPayId,
	onPay,
	onNewOrder,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	totals: CartTotals;
	sessionKey: string;
	promptPayId: string | null;
	onPay: (method: PaymentMethod, received: Satang | null) => Promise<CompletedPayment>;
	onNewOrder: () => void;
}) {
	const t = useTranslations("checkout");
	const [method, setMethod] = useState<PaymentMethod>("CASH");
	const [done, setDone] = useState<CompletedPayment | null>(null);
	const [pending, setPending] = useState(false);

	const complete = async (received: Satang | null) => {
		setPending(true);
		try {
			setDone(await onPay(method, received));
		} catch (error) {
			toast.error(error instanceof Error ? error.message : t("failed"));
		} finally {
			setPending(false);
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (pending) return;
				if (!next && done) onNewOrder();
				onOpenChange(next);
			}}
		>
			<DialogContent className="max-h-[94svh] gap-0 overflow-y-auto rounded-3xl p-0 sm:max-w-3xl">
				<DialogTitle className="sr-only">{t("title")}</DialogTitle>
				<DialogDescription className="sr-only">{t("description")}</DialogDescription>

				<AnimatePresence mode="wait" initial={false}>
					{done ? (
						<motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
							<SuccessPane payment={done} onNewOrder={onNewOrder} />
						</motion.div>
					) : (
						<motion.div
							key="pay"
							exit={{ opacity: 0 }}
							className="grid tablet:grid-cols-[260px_1fr]"
						>
							<aside className="flex flex-col gap-5 border-b bg-muted/40 p-6 tablet:border-r tablet:border-b-0">
								<div>
									<p className="font-semibold text-lg">{t("title")}</p>
									<p className="text-muted-foreground text-sm">{t("newOrderLabel")}</p>
								</div>
								<div>
									<p className="text-muted-foreground text-sm">{t("amountDue")}</p>
									<p className="numeric font-bold text-4xl tracking-tight">{formatBaht(totals.total)}</p>
									<p className="mt-1 text-muted-foreground text-xs">
										{t("itemCount", { count: totals.itemCount })}
									</p>
								</div>
								<div role="radiogroup" aria-label={t("method")} className="grid grid-cols-4 gap-2 tablet:grid-cols-2">
									{METHODS.map((m) => (
										<MethodCard key={m} method={m} selected={m === method} onSelect={() => !pending && setMethod(m)} />
									))}
								</div>
							</aside>

							{/* A disabled fieldset freezes every button in the pane while the API answers. */}
							<fieldset disabled={pending} className="min-h-[420px] p-6 disabled:opacity-70">
								{method === "CASH" ? (
									<CashPane total={totals.total} onConfirm={(received) => void complete(received)} />
								) : method === "PROMPTPAY" ? (
									<PromptPayPane total={totals.total} promptPayId={promptPayId} onConfirm={() => void complete(null)} />
								) : (
									<SimplePane method={method} onConfirm={() => void complete(null)} />
								)}
							</fieldset>
						</motion.div>
					)}
				</AnimatePresence>
			</DialogContent>
		</Dialog>
	);
}
