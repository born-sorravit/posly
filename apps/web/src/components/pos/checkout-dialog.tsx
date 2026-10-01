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
import { Check, Delete, Loader2, type LucideIcon, Printer, ShoppingCart } from "lucide-react";
import { SendReceiptButton } from "@/components/receipt/send-receipt";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { type ReactNode, createContext, useContext, useEffect, useState } from "react";
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

/**
 * One way to pay, as a row: icon, name and what it does. Rows rather than tiles, so a long name
 * ("บัตรเครดิต/เดบิต") fits and the four read as a list to pick from.
 */
function MethodRow({
	method,
	selected,
	onSelect,
}: {
	method: PaymentMethod;
	selected: boolean;
	onSelect: () => void;
}) {
	const t = useTranslations("paymentMethod");
	const tHint = useTranslations("checkout.methodHint");
	const tShort = useTranslations("checkout.methodShort");
	const Icon = PAYMENT_ICON[method];
	return (
		<button
			type="button"
			role="radio"
			aria-checked={selected}
			onClick={onSelect}
			className={cn(
				// A phone lays the four out in one row, icon over name; from tablet up, a list.
				"touch-target flex w-full flex-col items-center gap-1.5 rounded-2xl p-2 text-center ring-1 transition-colors",
				"tablet:flex-row tablet:gap-3 tablet:p-2.5 tablet:text-left",
				selected ? "bg-primary/10 ring-2 ring-primary" : "bg-card ring-border hover:bg-muted"
			)}
		>
			<span
				className={cn(
					"flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors",
					selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
				)}
			>
				<Icon className="size-5" />
			</span>
			<span className="min-w-0 tablet:flex-1">
				{/* A phone's tile is a quarter of the width: the short name ("บัตร"), full from tablet up. */}
				<span className="block truncate font-medium text-xs tablet:hidden">{tShort(method)}</span>
				<span className="hidden truncate font-medium text-sm tablet:block">{t(method)}</span>
				<span className="hidden truncate text-muted-foreground text-xs tablet:block">{tHint(method)}</span>
			</span>
			{selected ? <Check className="hidden size-4 shrink-0 text-primary tablet:block" /> : null}
		</button>
	);
}

/**
 * Every method's pane has the same frame: what is being taken, the working area in the middle,
 * and the one confirming action pinned at the bottom — same place, same size, whichever method.
 */
function PaneShell({
	title,
	children,
	action,
	center = false,
}: {
	title: ReactNode;
	children: ReactNode;
	action: ReactNode;
	center?: boolean;
}) {
	return (
		<div className="flex h-full min-h-0 flex-1 flex-col">
			<p className="px-5 pt-4 font-semibold text-base tablet:px-6 tablet:pt-6 tablet:text-lg">{title}</p>
			<div
				className={cn(
					"pane-body flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4 transition-opacity tablet:px-6 tablet:py-5",
					center && "items-center justify-center text-center"
				)}
			>
				{children}
			</div>
			{/* Pinned: on a phone the dialog scrolls as one, and the button must not scroll away. */}
			<div className="sticky bottom-0 z-10 border-t bg-popover px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] tablet:static tablet:bg-muted/30 tablet:px-6 tablet:pt-4 tablet:pb-4">
				{action}
			</div>
		</div>
	);
}

/** Whether the API is taking the payment; every pane's confirm button reads it. */
const PayingContext = createContext(false);

/**
 * The one confirming action, same in every pane. While the API answers it keeps its full colour
 * (the rest of the pane dims) and says what is happening, so a slow network reads as working,
 * not as a tap that did nothing.
 */
function ConfirmButton({ label, onClick, disabled = false }: { label: string; onClick?: () => void; disabled?: boolean }) {
	const t = useTranslations("checkout");
	const paying = useContext(PayingContext);
	return (
		<Button
			disabled={disabled || paying}
			onClick={onClick}
			aria-busy={paying}
			className={cn(
				"brand-gradient h-14 w-full rounded-2xl font-semibold text-base",
				paying && "disabled:opacity-100"
			)}
		>
			{paying ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
			{paying ? t("processing") : label}
		</Button>
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
	const tMethod = useTranslations("paymentMethod");
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
		<PaneShell
			title={t("payWith", { method: tMethod("CASH") })}
			action={
				<ConfirmButton disabled={!enough} onClick={() => onConfirm(received)} label={t("confirm")} />
			}
		>
			<div className="flex flex-col gap-3 tablet:gap-4">
				{/* What was handed over, and what goes back: the two numbers the cashier reads. */}
				<div className="grid grid-cols-2 gap-3">
					<div className="rounded-2xl bg-muted/60 px-4 py-3 tablet:p-4">
						<p className="text-muted-foreground text-xs">{t("receivedAmount")}</p>
						<p className="numeric mt-1 font-semibold text-xl tracking-tight tablet:text-2xl">{formatBaht(received)}</p>
					</div>
					<div className={cn("rounded-2xl px-4 py-3 ring-1 tablet:p-4", enough ? "bg-success/10 ring-success/30" : "bg-danger/10 ring-danger/30")}>
						<p className={cn("text-xs", enough ? "text-success" : "text-danger")}>{t("change")}</p>
						<p className={cn("numeric mt-1 font-bold text-xl tracking-tight tablet:text-2xl", enough ? "text-success" : "text-danger")}>
							{formatBaht(change)}
						</p>
					</div>
				</div>

				<div className="grid grid-cols-4 gap-2">
					{quick.map((amount) => {
						const active = typed === "" ? amount === total : received === amount;
						return (
							<button
								key={amount}
								type="button"
								onClick={() => setTyped(String(amount / 100))}
								className={cn(
									"touch-target numeric h-11 rounded-xl font-semibold text-sm ring-1 transition-colors",
									active ? "bg-primary/10 text-primary ring-2 ring-primary" : "bg-card ring-border hover:bg-muted"
								)}
							>
								{formatBaht(amount)}
							</button>
						);
					})}
				</div>

				<div className="grid grid-cols-3 gap-2">
					{KEYS.map((key) => (
						<button
							key={key}
							type="button"
							onClick={() => press(key)}
							aria-label={key === "del" ? t("delete") : key}
							className="touch-target numeric flex h-11 items-center justify-center rounded-xl bg-muted/70 font-semibold text-lg transition-colors hover:bg-muted active:scale-95 tablet:h-12"
						>
							{key === "del" ? <Delete className="size-5" /> : key}
						</button>
					))}
				</div>
			</div>
		</PaneShell>
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

	const title = t("payWith", { method: "PromptPay" });
	if (!promptPayId) {
		return (
			<PaneShell
				title={title}
				center
				action={
					<ConfirmButton disabled label={t("received")} />
				}
			>
				<p className="font-medium">{t("promptPayMissing")}</p>
				<p className="mt-1 text-muted-foreground text-sm">{t("promptPayMissingHint")}</p>
			</PaneShell>
		);
	}

	const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
	const ss = String(secondsLeft % 60).padStart(2, "0");

	return (
		<PaneShell
			title={title}
			center
			action={
				<ConfirmButton onClick={onConfirm} label={t("received")} />
			}
		>
			{/* White whatever the theme: a banking app scans dark-on-light. */}
			<div className="flex w-full max-w-[17rem] flex-col items-center gap-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
				<p className="flex items-center gap-2 font-semibold text-[#0f3d68] text-sm">
					<span className="rounded bg-[#0f3d68] px-1.5 py-0.5 font-bold text-[10px] text-white">PromptPay</span>
					{t("scanToPay")}
				</p>
				<QRCodeSVG
					value={promptPayPayload(promptPayId, total)}
					size={192}
					level="M"
					marginSize={0}
					className="h-auto w-full max-w-48"
				/>
				<p className="numeric font-bold text-2xl text-[#111827]">{formatBaht(total)}</p>
			</div>
			<p className="numeric mt-3 text-muted-foreground text-xs">
				{t("expiresIn")} {mm}:{ss}
			</p>
			<p className="mt-1 max-w-xs text-muted-foreground text-sm">{t("promptPayHint")}</p>
		</PaneShell>
	);
}

function SimplePane({ onConfirm, method, total }: { onConfirm: () => void; method: PaymentMethod; total: Satang }) {
	const t = useTranslations("checkout");
	const tMethod = useTranslations("paymentMethod");
	const Icon = PAYMENT_ICON[method];
	return (
		<PaneShell
			title={t("payWith", { method: tMethod(method) })}
			center
			action={
				<ConfirmButton onClick={onConfirm} label={t("confirm")} />
			}
		>
			<span className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
				<Icon className="size-8" />
			</span>
			<p className="numeric mt-4 font-bold text-3xl tracking-tight">{formatBaht(total)}</p>
			<p className="mt-2 max-w-xs text-pretty text-muted-foreground text-sm">
				{t(method === "CARD" ? "cardHint" : "otherHint")}
			</p>
		</PaneShell>
	);
}

/**
 * The success screen (plan §13): the change to hand back first (what the cashier needs this
 * second), then the order number, and the receipt exactly as it will print beside it.
 * "New order" is the primary action and takes focus, so Enter starts the next sale.
 */
function SuccessPane({
	payment,
	onNewOrder,
	doneLabel,
	doneIcon: DoneIcon = ShoppingCart,
}: {
	payment: CompletedPayment;
	onNewOrder: () => void;
	doneLabel?: string;
	doneIcon?: LucideIcon;
}) {
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
						<DoneIcon className="size-5" />
						{doneLabel ?? t("newOrder")}
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
	/** The success screen's main button, when it does something other than start a new order. */
	doneLabel?: string;
	doneIcon?: LucideIcon;
	/** Opens on this method, e.g. PromptPay when the guest says they already transferred. */
	initialMethod?: PaymentMethod;
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
	doneLabel,
	doneIcon,
	initialMethod = "CASH",
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	totals: CartTotals;
	sessionKey: string;
	promptPayId: string | null;
	onPay: (method: PaymentMethod, received: Satang | null) => Promise<CompletedPayment>;
	onNewOrder: () => void;
	doneLabel?: string;
	doneIcon?: LucideIcon;
	initialMethod?: PaymentMethod;
}) {
	const t = useTranslations("checkout");
	const [method, setMethod] = useState<PaymentMethod>(initialMethod);
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
			<DialogContent
				className={cn(
					"max-h-[94svh] gap-0 overflow-y-auto rounded-3xl p-0 sm:max-w-[min(48rem,calc(100%-2rem))]",
					// A phone gets the whole screen: a floating card left the keypad under the button.
					"max-tablet:top-0 max-tablet:left-0 max-tablet:h-svh max-tablet:max-h-svh max-tablet:w-full max-tablet:max-w-none max-tablet:translate-x-0 max-tablet:translate-y-0 max-tablet:rounded-none max-tablet:ring-0",
					// One size whichever method is picked, so switching does not make it jump.
					!done && "tablet:h-[min(640px,94svh)] tablet:overflow-hidden desktop:max-w-4xl"
				)}
			>
				<DialogTitle className="sr-only">{t("title")}</DialogTitle>
				<DialogDescription className="sr-only">{t("description")}</DialogDescription>

				<AnimatePresence mode="wait" initial={false}>
					{done ? (
						<motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
							<SuccessPane payment={done} onNewOrder={onNewOrder} doneLabel={doneLabel} doneIcon={doneIcon} />
						</motion.div>
					) : (
						<motion.div
							key="pay"
							exit={{ opacity: 0 }}
							className="grid h-full min-h-0 grid-rows-[auto_1fr] tablet:grid-cols-[280px_1fr] tablet:grid-rows-1"
						>
							<aside className="flex min-h-0 flex-col gap-4 border-b bg-muted/40 px-5 pt-5 pb-4 tablet:gap-5 tablet:border-r tablet:border-b-0 tablet:p-6">
								<div>
									<p className="text-muted-foreground text-sm">{t("amountDue")}</p>
									<p className="numeric mt-1 font-bold text-3xl tracking-tight tablet:text-4xl">{formatBaht(totals.total)}</p>
									{/* The breakdown is for the counter screen; a phone keeps the space for the keypad. */}
									<dl className="mt-3 hidden space-y-1 text-muted-foreground text-xs tablet:block">
										<div className="flex justify-between">
											<dt>{t("itemCount", { count: totals.itemCount })}</dt>
											<dd className="numeric">{formatBaht(totals.subtotal)}</dd>
										</div>
										{totals.discount > 0 ? (
											<div className="flex justify-between">
												<dt>{t("discount")}</dt>
												<dd className="numeric">−{formatBaht(totals.discount)}</dd>
											</div>
										) : null}
										{totals.vat > 0 ? (
											<div className="flex justify-between">
												<dt>{t("vat")}</dt>
												<dd className="numeric">{formatBaht(totals.vat)}</dd>
											</div>
										) : null}
									</dl>
								</div>
								<div className="space-y-2">
									<p className="hidden font-medium text-muted-foreground text-xs tablet:block">{t("method")}</p>
									<div role="radiogroup" aria-label={t("method")} className="grid grid-cols-4 gap-2 tablet:grid-cols-1">
										{METHODS.map((m) => (
											<MethodRow key={m} method={m} selected={m === method} onSelect={() => !pending && setMethod(m)} />
										))}
									</div>
								</div>
							</aside>

							{/* A disabled fieldset freezes every button in the pane while the API answers. */}
							<PayingContext.Provider value={pending}>
							{/* Disabled while paying, so nothing else can be tapped; the pane dims, the button does not. */}
							<fieldset disabled={pending} className="flex min-h-0 min-w-0 flex-col [&:disabled_.pane-body]:opacity-60">
								{method === "CASH" ? (
									<CashPane total={totals.total} onConfirm={(received) => void complete(received)} />
								) : method === "PROMPTPAY" ? (
									<PromptPayPane total={totals.total} promptPayId={promptPayId} onConfirm={() => void complete(null)} />
								) : (
									<SimplePane method={method} total={totals.total} onConfirm={() => void complete(null)} />
								)}
							</fieldset>
							</PayingContext.Provider>
						</motion.div>
					)}
				</AnimatePresence>
			</DialogContent>
		</Dialog>
	);
}
