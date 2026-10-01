"use client";

import { ConfirmDialog } from "@/components/common/controls";
import { EmptyState, PageContainer, PageHeader, toneStyle } from "@/components/common/primitives";
import { Segmented } from "@/components/common/controls";
import { type CompletedPayment, CheckoutDialog } from "@/components/pos/checkout-dialog";
import { DiscountControl } from "@/components/pos/discount-control";
import { MergeTabDialog, MoveTabDialog, SplitTabDialog } from "@/components/tables/tab-actions";
import { TableQrDialog } from "@/components/tables/table-qr";
import { TableGridSkeleton } from "@/components/tables/tables-skeletons";
import { useTab, useTabMutations, useTableBoard, useTableMutations } from "@/hooks/use-posly";
import { useNow } from "@/hooks/use-now";
import { useActiveBusiness, useFeature } from "@/hooks/use-workspace";
import { FeatureLocked } from "@/components/common/feature-locked";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import type { BoardTableDto, TabDto, TableCallKind, TableRequestDto } from "@/lib/api/posly";
import { cn } from "@/lib/utils";
import { type CartTotals, type Discount, resolveDiscount, useCartStore } from "@/stores/cart-store";
import type { PaymentMethod } from "@posly/types/domain";
import { Button } from "@posly/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@posly/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@posly/ui/components/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@posly/ui/components/sheet";
import { Input } from "@posly/ui/components/input";
import { Skeleton } from "@posly/ui/components/skeleton";
import { formatClock } from "@posly/utils/format";
import { addedTax, formatBaht, includedTax, type Satang } from "@posly/utils/money";
import { ArrowRightLeft, Ban, Check, Clock3, Combine, HandPlatter, Loader2, MoreHorizontal, Plus, QrCode, ReceiptText, Settings2, Split, Users, TriangleAlert, UtensilsCrossed, Wallet, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { type ReactNode, useMemo, useState } from "react";
import { toast } from "sonner";

const minutesSince = (iso: string, now: Date) => Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000));

/** The tab's bill with a discount taken off — the same arithmetic as the POS cart and the API. */
const tabTotals = (tab: TabDto, discount: Discount | null, vatBasisPoints: number, pricesIncludeVat: boolean): CartTotals => {
	const subtotal = tab.lines.reduce((sum, l) => sum + l.lineTotal, 0);
	const off = resolveDiscount(discount, subtotal);
	const taxable = subtotal - off;
	const vat = pricesIncludeVat ? includedTax(taxable, vatBasisPoints) : addedTax(taxable, vatBasisPoints);
	return {
		itemCount: tab.lines.reduce((n, l) => n + l.quantity, 0),
		subtotal,
		discount: off,
		vat,
		total: pricesIncludeVat ? taxable : taxable + vat,
	};
};

/** Roomy rows for the tab's "…" menu: thumb-sized, with the icon set apart from the words. */
const MENU_ROW = "h-10 gap-3 rounded-lg px-2.5 text-sm [&_svg]:size-[18px]";
const MENU_ITEM = `${MENU_ROW} [&_svg]:text-muted-foreground`;

const CALL_ICON: Record<TableCallKind, typeof ReceiptText> = {
	WAITER: HandPlatter,
	BILL: ReceiptText,
	PAID: Wallet,
};

/** A guest at the table is asking for staff or the bill: loud until someone acknowledges it. */
function CallChip({ kind }: { kind: TableCallKind }) {
	const t = useTranslations("tables.call");
	const Icon = CALL_ICON[kind];
	return (
		<span className="flex w-fit shrink-0 items-center gap-1 rounded-full bg-warning px-2 py-0.5 font-semibold text-[11px] text-warning-foreground">
			<Icon className="size-3" />
			{t(kind)}
		</span>
	);
}

/**
 * The call on the table, with the button staff press once they have answered it. "I paid"
 * is answered by checking the bank app and taking the payment, so it leads to check-out.
 */
function CallBanner({
	table,
	total,
	onCheckPaid,
}: {
	table: BoardTableDto;
	total?: number;
	onCheckPaid?: () => void;
}) {
	const t = useTranslations("tables.call");
	const { dismissCall } = useTableMutations();
	if (!table.call) return null;
	const Icon = CALL_ICON[table.call.kind];
	const paid = table.call.kind === "PAID";
	return (
		<div className="flex items-center gap-3 rounded-2xl bg-warning/12 p-3 ring-1 ring-warning/40">
			<span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-warning text-warning-foreground">
				<Icon className="size-4" />
			</span>
			<div className="min-w-0 flex-1">
				<p className="font-semibold text-sm">{t(table.call.kind)}</p>
				<p className="numeric text-muted-foreground text-xs" suppressHydrationWarning>
					{paid && total !== undefined
						? `${formatClock(table.call.at)} · ${t("paidHint", { total: formatBaht(total) })}`
						: formatClock(table.call.at)}
				</p>
			</div>
			{paid && onCheckPaid ? (
				<Button size="sm" className="shrink-0" onClick={onCheckPaid}>
					<Check />
					{t("checkPaid")}
				</Button>
			) : (
			<Button
				variant="outline"
				size="sm"
				disabled={dismissCall.isPending}
				onClick={() =>
					dismissCall.mutate(table.id, {
						onSuccess: () => toast(t("dismissed")),
						onError: (e) => toast.error(e.message),
					})
				}
			>
				{dismissCall.isPending ? <Loader2 className="animate-spin" /> : <Check />}
				{t("dismiss")}
			</Button>
			)}
		</div>
	);
}

/**
 * How long a table has sat, as a colour: fresh is green, an hour in is blue, two hours amber.
 * Never red — a long lunch is not an error — and never the warning fill, which means a guest
 * is waiting on staff.
 */
const sittingTone = (minutes: number) =>
	minutes < 60 ? "bg-success/12 text-success" : minutes < 120 ? "bg-chart-4/15 text-chart-4" : "bg-chart-3/15 text-chart-3";

/** A zone's own colour on its heading, so "ในร้าน" and "ระเบียง" separate at a glance. */
const ZONE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

/** A filter option with the dot of the state it shows — the same colours as the cards. */
function FilterLabel({ dot, children }: { dot: string; children: ReactNode }) {
	return (
		<span className="flex items-center gap-1.5">
			<span className={cn("size-1.5 rounded-full", dot)} aria-hidden />
			{children}
		</span>
	);
}

/** Beside a zone's name: how many of its tables are free and how many seated. */
function ZoneSplit({ tables }: { tables: BoardTableDto[] }) {
	const t = useTranslations("tables");
	const seated = tables.filter((table) => table.tab).length;
	const free = tables.filter((table) => !table.tab && table.isActive).length;
	return (
		<span className="flex items-center gap-1.5 font-normal text-xs">
			{free ? (
				<span className="rounded-full bg-success/12 px-2 py-0.5 text-success">{t("filter.free", { count: free })}</span>
			) : null}
			{seated ? (
				<span className="rounded-full bg-chart-4/15 px-2 py-0.5 text-chart-4">{t("filter.occupied", { count: seated })}</span>
			) : null}
		</span>
	);
}

/**
 * One table on the floor. Free tables are quiet outlines, seated ones are filled with their
 * bill, and one with a guest's round waiting is the loudest thing on the screen.
 */
function TableCard({ table, now, onSelect }: { table: BoardTableDto; now: Date; onSelect: () => void }) {
	const t = useTranslations("tables");
	const tab = table.tab;
	/** "45 นาที" under an hour, then "6 ชม." or "6 ชม. 12 น." — short enough for a phone's card. */
	const sitting = (minutes: number) =>
		minutes < 60
			? t("sitMinutes", { count: minutes })
			: minutes % 60 === 0
				? t("sitHours", { hours: Math.floor(minutes / 60) })
				: t("sitHoursMinutes", { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
	const waiting = tab?.pendingRequests ?? 0;
	const alerting = waiting > 0 || Boolean(table.call);

	if (!tab) {
		return (
			<button
				type="button"
				onClick={onSelect}
				disabled={!table.isActive}
				className={cn(
					"group flex min-h-36 flex-col justify-between rounded-2xl border-2 border-dashed p-4 text-left transition-colors",
					table.call
						? "border-warning bg-warning/10"
						: table.isActive
							? "border-border hover:border-primary/50 hover:bg-primary/5"
							: "cursor-not-allowed border-border/60 opacity-50"
				)}
			>
				<span>
					<span className="block font-semibold text-base text-muted-foreground group-hover:text-foreground">
						{table.name}
					</span>
					{table.seats ? (
						<span className="mt-0.5 flex items-center gap-1 whitespace-nowrap text-muted-foreground text-xs">
							<Users className="size-3.5" />
							{t("seats", { count: table.seats })}
						</span>
					) : null}
					{table.call ? (
						<span className="mt-1.5 block">
							<CallChip kind={table.call.kind} />
						</span>
					) : null}
				</span>
				<span className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs group-hover:text-primary">
					{table.isActive ? (
						<>
							<Plus className="size-3.5" />
							{t("openAction")}
						</>
					) : (
						t("inactive")
					)}
				</span>
			</button>
		);
	}

	return (
		<button
			type="button"
			onClick={onSelect}
			style={toneStyle(alerting ? "warning" : "info")}
			className={cn(
				"tint-surface surface-hover relative flex min-h-36 flex-col gap-3 overflow-hidden rounded-2xl p-4 pl-5 text-left",
				// A shadow alone is lost on the dark theme: the edge and the wash say "this opens".
				"transition-[background-color,box-shadow,transform] hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
				alerting ? "ring-2 ring-warning hover:bg-warning/8" : "hover:bg-chart-4/8 hover:ring-1 hover:ring-chart-4/50"
			)}
		>
			{/* Seated at a glance across the room, like a ticket's edge on the kitchen screen. */}
			<span
				aria-hidden
				className={cn("absolute inset-y-0 left-0 w-1", alerting ? "bg-warning" : "bg-chart-4")}
			/>
			<span className="flex items-start justify-between gap-2">
				<span className="min-w-0 truncate font-semibold text-base leading-tight">{table.name}</span>
				{waiting > 0 ? (
					<span className="flex shrink-0 items-center gap-1 rounded-full bg-warning px-2 py-0.5 font-semibold text-[11px] text-warning-foreground">
						<span className="relative flex size-1.5">
							<span className="absolute inline-flex size-full animate-ping rounded-full bg-warning-foreground opacity-60" />
							<span className="relative inline-flex size-1.5 rounded-full bg-warning-foreground" />
						</span>
						{t("newRequests", { count: waiting })}
					</span>
				) : (
					<span
						className={cn(
							"numeric flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 font-medium text-[11px]",
							sittingTone(minutesSince(tab.openedAt, now))
						)}
						suppressHydrationWarning
					>
						<Clock3 className="size-3" />
						{sitting(minutesSince(tab.openedAt, now))}
					</span>
				)}
			</span>
			{table.call ? <CallChip kind={table.call.kind} /> : null}
			{/* The bill, then what's on it — one quiet line, so the total has room to read across the room. */}
			<span className="mt-auto flex flex-col gap-1.5">
				{tab.itemCount > 0 ? (
					<span className="numeric font-bold text-2xl leading-none tracking-tight">{formatBaht(tab.total)}</span>
				) : (
					<span className="font-medium text-muted-foreground text-sm leading-tight">{t("noItems")}</span>
				)}
				<span className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground text-xs">
					{tab.itemCount > 0 ? <span>{t("items", { count: tab.itemCount })}</span> : null}
					{tab.itemCount > 0 && (tab.guests || table.seats) ? <span aria-hidden>·</span> : null}
					{tab.guests || table.seats ? (
						<span className="flex items-center gap-1">
							<Users className="size-3.5 shrink-0" />
							{tab.guests && table.seats
								? t("guestsOfSeats", { count: tab.guests, seats: table.seats })
								: tab.guests
									? t("guests", { count: tab.guests })
									: t("seats", { count: table.seats ?? 0 })}
						</span>
					) : null}
				</span>
			</span>
		</button>
	);
}

/** Chips go up to the table's seats (at most 9); the last chip opens a field for more. */
const MAX_CHIPS = 9;
const MAX_GUESTS = 99;

function OpenTableDialog({ table, onOpenChange, onOpened }: { table: BoardTableDto | null; onOpenChange: (open: boolean) => void; onOpened: (tab: TabDto) => void }) {
	const t = useTranslations("tables.open");
	const { open } = useTabMutations();
	const { dismissCall } = useTableMutations();
	const [guests, setGuests] = useState(0);
	// What is typed for a big party; the count only takes it once it is a valid number.
	const [manyText, setManyText] = useState("");
	const seats = table?.seats ?? null;
	const chips = Array.from({ length: Math.min(seats ?? MAX_CHIPS, MAX_CHIPS) }, (_, i) => i + 1);
	// The chip after the last number: "more than the seats", or 10+ for a big or unset table.
	const more = chips.length + 1;

	return (
		<Dialog open={table !== null} onOpenChange={onOpenChange}>
			<DialogContent className="gap-6 p-6 sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{table ? t("title", { table: table.name }) : null}</DialogTitle>
					<DialogDescription>
						{table?.seats ? `${t("description")} · ${t("seatsHint", { count: table.seats })}` : t("description")}
					</DialogDescription>
				</DialogHeader>
				{table ? <CallBanner table={table} /> : null}
				<div className="space-y-2.5">
					<p className="font-medium text-sm">{t("guests")}</p>
					{/* One tap picks; tapping the picked one again leaves it unset — it is optional. */}
					<div
						role="radiogroup"
						aria-label={t("guests")}
						className="grid gap-2"
						// A small table's chips fit one row; a big or unset one wraps in fives.
						style={{ gridTemplateColumns: `repeat(${chips.length + 1 <= 6 ? chips.length + 1 : 5}, minmax(0, 1fr))` }}
					>
						{[...chips, more].map((n) => {
							const isMore = n === more;
							const on = isMore ? guests >= more : guests === n;
							return (
								<button
									key={n}
									type="button"
									role="radio"
									aria-checked={on}
									onClick={() => {
										setGuests(on ? 0 : n);
										if (isMore) setManyText(on ? "" : String(more));
									}}
									className={cn(
										"numeric h-11 whitespace-nowrap rounded-xl px-1 font-semibold text-sm transition-colors",
										on
											? "bg-primary text-primary-foreground"
											: "bg-muted/70 text-foreground hover:bg-muted"
									)}
								>
									{isMore ? t("orMore", { count: more }) : n}
								</button>
							);
						})}
					</div>
					{guests >= more ? (
						<div className="flex items-center gap-3 pt-1">
							<label htmlFor="open-guests" className="text-muted-foreground text-sm">
								{t("manyLabel")}
							</label>
							<Input
								id="open-guests"
								// biome-ignore lint/a11y/noAutofocus: shown because they asked to type the number
								autoFocus
								inputMode="numeric"
								maxLength={2}
								value={manyText}
								onChange={(e) => {
									const text = e.target.value.replace(/\D/g, "");
									setManyText(text);
									const n = Number(text);
									if (n >= more && n <= MAX_GUESTS) setGuests(n);
								}}
								onBlur={() => setManyText(String(guests))}
								className="numeric h-11 w-24 rounded-xl text-center font-semibold"
							/>
							<span className="text-muted-foreground text-sm">{t("people")}</span>
						</div>
					) : null}
					{/* Over the seats is allowed — a chair pulled up, two tables pushed together — but said. */}
					{seats && guests > seats ? (
						<p className="flex items-start gap-2 rounded-xl bg-warning/12 px-3 py-2.5 text-sm">
							<TriangleAlert className="mt-0.5 size-4 shrink-0" />
							<span>{t("overSeats", { over: guests - seats, seats })}</span>
						</p>
					) : null}
				</div>
				<DialogFooter className="-mx-6 -mb-6 mt-2 px-6 py-4">
					<Button variant="outline" size="lg" onClick={() => onOpenChange(false)}>
						{t("cancel")}
					</Button>
					<Button
						size="lg"
						className="brand-gradient"
						disabled={open.isPending || !table}
						onClick={() =>
							table &&
							open.mutate(
								{ tableId: table.id, guests: guests || undefined },
								{
									onSuccess: (tab) => {
										toast.success(t("opened", { table: table.name }));
										// Staff came over and seated them: a call for staff is answered.
										if (table.call?.kind === "WAITER") dismissCall.mutate(table.id);
										onOpened(tab);
									},
									onError: (e) => toast.error(e.message),
								}
							)
						}
					>
						{open.isPending ? <Loader2 className="animate-spin" /> : null}
						{t("confirm")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function RequestCard({ request, onTabClosed }: { request: TableRequestDto; onTabClosed: () => void }) {
	const t = useTranslations("tables.tab");
	const { accept, reject } = useTabMutations();
	const busy = accept.isPending || reject.isPending;
	const onError = (e: Error) => toast.error(e.message);
	return (
		<li className="space-y-3 rounded-2xl bg-warning/10 p-3.5 ring-1 ring-warning/40">
			<p className="flex items-center gap-2 font-medium text-xs">
				<span className="size-2 rounded-full bg-warning" aria-hidden />
				<span suppressHydrationWarning>{t("requestFrom", { time: formatClock(request.createdAt) })}</span>
			</p>
			<ul className="space-y-1.5">
				{request.items.map((item, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: a request's lines never reorder
					<li key={i} className="flex gap-2 text-sm">
						<span className="numeric shrink-0 font-semibold">{item.quantity}×</span>
						<span className="min-w-0 flex-1">
							<span className="block font-medium">{item.name}</span>
							{item.modifiers.length ? <span className="block text-muted-foreground text-xs">{item.modifiers.join(" · ")}</span> : null}
							{item.note ? <span className="block text-muted-foreground text-xs">“{item.note}”</span> : null}
						</span>
						<span className="numeric shrink-0">{formatBaht(item.unitPrice * item.quantity)}</span>
					</li>
				))}
			</ul>
			<div className="flex gap-2">
				<Button
					variant="outline"
					className="h-11 flex-1 tablet:h-9"
					disabled={busy}
					onClick={() =>
						reject.mutate(request.id, {
							onSuccess: (tab) => {
								toast(t("rejected"));
								// A guest-opened table whose only round was turned down is free again.
								if (tab.status !== "OPEN") onTabClosed();
							},
							onError,
						})
					}
				>
					{reject.isPending ? <Loader2 className="animate-spin" /> : <X />}
					{t("reject")}
				</Button>
				<Button
					className="h-11 flex-[2] tablet:h-9"
					disabled={busy}
					onClick={() => accept.mutate(request.id, { onSuccess: () => toast.success(t("accepted")), onError })}
				>
					{accept.isPending ? <Loader2 className="animate-spin" /> : <Check />}
					{t("accept")} · {formatBaht(request.total)}
				</Button>
			</div>
		</li>
	);
}

/** One open table: guests' rounds to accept, what is on the bill by round, and check-out. */
function TabSheet({ sessionId, onClose }: { sessionId: string | null; onClose: () => void }) {
	const t = useTranslations("tables.tab");
	const tTables = useTranslations("tables");
	const router = useRouter();
	const { business, can } = useActiveBusiness();
	const tab = useTab(sessionId);
	const board = useTableBoard();
	const { close, cancel } = useTabMutations();
	const hasTables = useFeature("TABLES");
	const hasQr = useFeature("QR_ORDERING");
	const [discount, setDiscount] = useState<Discount | null>(null);
	const [paying, setPaying] = useState(false);
	// The method check-out opens on: PromptPay when the guest has said they transferred.
	const [payMethod, setPayMethod] = useState<PaymentMethod>("CASH");
	const [cancelling, setCancelling] = useState(false);
	const [showQr, setShowQr] = useState(false);
	const [action, setAction] = useState<"move" | "merge" | "split" | null>(null);
	const tActions = useTranslations("tables.actions");
	const [replacingCart, setReplacingCart] = useState(false);
	const data = tab.data;
	const table = board.data?.find((b) => b.id === data?.tableId) ?? null;
	const pending = data?.requests.filter((r) => r.status === "PENDING") ?? [];
	const totals = data ? tabTotals(data, discount, business.vatBasisPoints, business.pricesIncludeVat) : null;

	const rounds = useMemo(() => {
		const byRound = new Map<number, TabDto["lines"]>();
		for (const line of data?.lines ?? []) byRound.set(line.round, [...(byRound.get(line.round) ?? []), line]);
		return [...byRound.entries()];
	}, [data?.lines]);

	const goAdd = () => {
		if (!data) return;
		useCartStore.getState().setTable({ sessionId: data.id, name: data.tableName });
		router.push("/pos");
	};
	// Lines already in the POS cart belong to another sale (or another table): never send them
	// onto this bill unasked.
	const addItems = () => {
		const cart = useCartStore.getState();
		if (cart.lines.length > 0 && cart.table?.sessionId !== data?.id) setReplacingCart(true);
		else goAdd();
	};

	const pay = async (method: PaymentMethod, received: Satang | null): Promise<CompletedPayment> => {
		if (!data || !totals) throw new Error();
		const order = await close.mutateAsync({
			sessionId: data.id,
			discount: totals.discount,
			payment: { method, received: received ?? undefined },
		});
		toast.success(t("paid", { table: data.tableName }));
		return { order, method: order.paymentMethod, total: order.total, received: order.received, change: order.change, orderNumber: order.number };
	};

	const open = sessionId !== null && !paying;
	const closed = data && data.status !== "OPEN";

	return (
		<>
			<Sheet open={open} onOpenChange={(next) => !next && onClose()}>
				<SheetContent side="right" className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
					<SheetHeader className="border-b px-5 pt-5 pb-4">
						<SheetTitle className="font-semibold text-lg">{data?.tableName ?? <Skeleton className="h-6 w-24" />}</SheetTitle>
						<SheetDescription suppressHydrationWarning>
							{data
								? [
										t("openedAt", { time: formatClock(data.openedAt) }),
										data.guests ? tTables("guests", { count: data.guests }) : null,
										data.orderNumber ? t("order", { number: data.orderNumber }) : null,
									]
										.filter(Boolean)
										.join(" · ")
								: t("description")}
						</SheetDescription>
					</SheetHeader>

					<div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
						{tab.isPending ? (
							<div className="space-y-2">
								<Skeleton className="h-24 w-full rounded-2xl" />
								<Skeleton className="h-10 w-full rounded-xl" />
								<Skeleton className="h-10 w-full rounded-xl" />
							</div>
						) : closed || tab.isError ? (
							<EmptyState icon={ReceiptText} title={t("notFound")} className="py-10" />
						) : data ? (
							<>
								{table ? (
									<CallBanner
										table={table}
										total={totals?.total}
										onCheckPaid={
											data.orderId
												? () => {
														setPayMethod("PROMPTPAY");
														setPaying(true);
													}
												: undefined
										}
									/>
								) : null}
								{pending.length > 0 ? (
									<section className="space-y-2">
										<h3 className="font-semibold text-sm">
											{t("requests")} · {pending.length}
										</h3>
										<ul className="space-y-2">
											{pending.map((r) => (
												<RequestCard key={r.id} request={r} onTabClosed={onClose} />
											))}
										</ul>
									</section>
								) : null}

								{rounds.length === 0 ? (
									<EmptyState icon={UtensilsCrossed} title={t("noItems")} description={t("noItemsHint")} className="py-8" />
								) : (
									rounds.map(([round, lines]) => (
										<section key={round} className="space-y-1">
											<h3 className="font-semibold text-muted-foreground text-xs">{t("round", { round })}</h3>
											<ul className="divide-y">
												{lines.map((line) => (
													<li key={line.id} className="flex gap-2 py-2 text-sm">
														<span className="numeric shrink-0 font-semibold">{line.quantity}×</span>
														<span className="min-w-0 flex-1">
															<span className="block font-medium">{line.name}</span>
															{line.modifiers.length ? (
																<span className="block text-muted-foreground text-xs">{line.modifiers.join(" · ")}</span>
															) : null}
															{line.note ? <span className="block text-muted-foreground text-xs">“{line.note}”</span> : null}
															{line.toKitchen ? (
																<span className="mt-1 flex items-center gap-1 text-muted-foreground text-xs">
																	<span
																		className={cn("size-1.5 rounded-full", line.preparedAt ? "bg-success" : "bg-warning")}
																		aria-hidden
																	/>
																	{line.preparedAt ? t("ready") : t("cooking")}
																</span>
															) : null}
														</span>
														<span className="numeric shrink-0">{formatBaht(line.lineTotal)}</span>
													</li>
												))}
											</ul>
										</section>
									))
								)}
							</>
						) : null}
					</div>

					{data && !closed && totals ? (
						<div className="space-y-3 border-t bg-muted/40 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
							<dl className="numeric grid gap-1.5 text-sm">
								<div className="flex justify-between text-muted-foreground">
									<dt>{t("subtotal")}</dt>
									<dd>{formatBaht(totals.subtotal)}</dd>
								</div>
								{can("orders:discount") && totals.subtotal > 0 ? (
									<DiscountControl subtotal={totals.subtotal} off={totals.discount} value={discount} onChange={setDiscount} />
								) : null}
								{business.vatBasisPoints > 0 ? (
									<div className="flex justify-between text-muted-foreground">
										<dt>{t("vat")}</dt>
										<dd>{formatBaht(totals.vat)}</dd>
									</div>
								) : null}
								<div className="flex items-baseline justify-between pt-1">
									<dt className="font-semibold text-base">{t("total")}</dt>
									<dd className="font-bold text-2xl tracking-tight">{formatBaht(totals.total)}</dd>
								</div>
							</dl>
							<div className="flex gap-2">
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="outline" size="icon-lg" className="h-12 w-12 rounded-xl" aria-label={t("more")}>
											<MoreHorizontal />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="start" side="top" className="w-60 p-1.5">
										{/* Grouped by what each acts on: the table, the bill, then the one that throws it away. */}
										{hasTables ? (
											<>
												<DropdownMenuItem className={MENU_ITEM} onClick={() => setAction("move")}>
													<ArrowRightLeft />
													{tActions("move")}
												</DropdownMenuItem>
												<DropdownMenuItem className={MENU_ITEM} onClick={() => setAction("merge")}>
													<Combine />
													{tActions("merge")}
												</DropdownMenuItem>
												<DropdownMenuSeparator className="my-1.5" />
											</>
										) : null}
										{data.orderId && data.lines.length > 0 ? (
											<DropdownMenuItem className={MENU_ITEM} onClick={() => setAction("split")}>
												<Split />
												{tActions("split")}
											</DropdownMenuItem>
										) : null}
										{table && hasQr ? (
											<DropdownMenuItem className={MENU_ITEM} onClick={() => setShowQr(true)}>
												<QrCode />
												{t("showQr")}
											</DropdownMenuItem>
										) : null}
										<DropdownMenuSeparator className="my-1.5" />
										<DropdownMenuItem variant="destructive" className={MENU_ROW} onClick={() => setCancelling(true)}>
											<Ban />
											{t("cancelTab")}
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
								{/* A shop past its plan can still settle the tab, not add to it. */}
								{hasTables ? (
									<Button variant="outline" className="h-12 flex-1 rounded-xl" onClick={addItems}>
										<Plus />
										{t("add")}
									</Button>
								) : null}
								<Button
									className="brand-gradient h-12 flex-1 rounded-xl font-semibold"
									disabled={!data.orderId || pending.length > 0}
									onClick={() => {
										setPayMethod("CASH");
										setPaying(true);
									}}
								>
									<ReceiptText />
									{t("checkout")}
								</Button>
							</div>
						</div>
					) : null}
				</SheetContent>
			</Sheet>

			{data && totals ? (
				<CheckoutDialog
					open={paying}
					onOpenChange={setPaying}
					totals={totals}
					sessionKey={data.id}
					promptPayId={business.promptPayId}
					onPay={pay}
					key={payMethod}
					initialMethod={payMethod}
					doneLabel={t("backToTables")}
					doneIcon={UtensilsCrossed}
					onNewOrder={() => {
						setPaying(false);
						setDiscount(null);
						onClose();
					}}
				/>
			) : null}

			<TableQrDialog table={showQr ? table : null} onOpenChange={setShowQr} />

			{data && table ? (
				<>
					<MoveTabDialog
						key={`move:${action === "move"}`}
						open={action === "move"}
						onOpenChange={(next) => !next && setAction(null)}
						tab={data}
						tables={board.data ?? []}
						branchId={table.branchId}
					/>
					<MergeTabDialog
						key={`merge:${action === "merge"}`}
						open={action === "merge"}
						onOpenChange={(next) => !next && setAction(null)}
						tab={data}
						tables={board.data ?? []}
						branchId={table.branchId}
					/>
				</>
			) : null}
			{data ? (
				<SplitTabDialog
					key={`split:${data.id}`}
					open={action === "split"}
					onOpenChange={(next) => !next && setAction(null)}
					tab={data}
				/>
			) : null}

			<ConfirmDialog
				open={replacingCart}
				onOpenChange={setReplacingCart}
				title={t("cartInUse")}
				description={t("cartInUseBody")}
				confirmLabel={t("cartInUseClear")}
				cancelLabel={t("cartInUseKeep")}
				onConfirm={() => {
					useCartStore.getState().clear();
					goAdd();
				}}
			/>

			<ConfirmDialog
				open={cancelling}
				onOpenChange={setCancelling}
				destructive
				title={data ? t("cancelTitle", { table: data.tableName }) : null}
				description={data?.orderId ? t("cancelBody") : t("cancelEmptyBody")}
				confirmLabel={t("cancelConfirm")}
				cancelLabel={t("keep")}
				onConfirm={() =>
					data &&
					cancel.mutate(
						{ sessionId: data.id },
						{
							onSuccess: () => {
								toast.success(t("cancelled"));
								onClose();
							},
							onError: (e) => toast.error(e.message),
						}
					)
				}
			/>
		</>
	);
}

/**
 * The floor (tables): every table at a glance — free, seated, or with a guest's round waiting —
 * and the open tab of whichever one is tapped. `?tab=` keeps the open tab in the URL, so the
 * POS can send staff straight back to it after adding a round.
 */
export function TablesView() {
	const t = useTranslations("tables");
	const { can } = useActiveBusiness();
	const hasTables = useFeature("TABLES");
	const board = useTableBoard();
	const now = useNow(30_000);
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const sessionId = searchParams.get("tab");
	const [opening, setOpening] = useState<BoardTableDto | null>(null);

	const setSession = (id: string | null) =>
		router.replace(id ? { pathname, query: { tab: id } } : pathname, { scroll: false });

	// Without the plan, only tabs still open are shown, so they can be settled.
	const tables = useMemo(
		() => (board.data ?? []).filter((table) => hasTables || table.tab),
		[board.data, hasTables]
	);
	const zones = useMemo(() => {
		const byZone = new Map<string, BoardTableDto[]>();
		for (const table of tables) {
			const zone = table.zone ?? "";
			byZone.set(zone, [...(byZone.get(zone) ?? []), table]);
		}
		return [...byZone.entries()];
	}, [tables]);
	const occupied = tables.filter((x) => x.tab).length;
	const free = tables.filter((x) => !x.tab && x.isActive).length;
	const needsStaff = (x: BoardTableDto) => (x.tab?.pendingRequests ?? 0) > 0 || Boolean(x.call);
	const waiting = tables.filter(needsStaff).length;
	const [filter, setFilter] = useState<"all" | "free" | "occupied" | "waiting">("all");
	const shown = (table: BoardTableDto) =>
		filter === "all" ||
		(filter === "free" && !table.tab && table.isActive) ||
		(filter === "occupied" && Boolean(table.tab)) ||
		(filter === "waiting" && needsStaff(table));

	if (!hasTables && !board.isPending && tables.length === 0)
		return <FeatureLocked title={t("lockedTitle")} hint={t("lockedHint")} action={t("upgrade")} />;

	return (
		<PageContainer>
			<PageHeader
				title={t("title")}
				description={t("description")}
				actions={
					can("settings:manage") && hasTables ? (
						<Button asChild variant="outline">
							<Link href="/settings/tables">
								<Settings2 />
								{t("manage")}
							</Link>
						</Button>
					) : null
				}
			/>

			{!hasTables ? (
				<div className="flex flex-col gap-3 rounded-2xl bg-warning/12 p-4 tablet:flex-row tablet:items-center">
					<TriangleAlert className="size-5 shrink-0" />
					<div className="min-w-0 flex-1">
						<p className="font-semibold text-sm">{t("lockedTitle")}</p>
						<p className="text-muted-foreground text-sm">{t("lockedOpenTabs")}</p>
					</div>
					<Button asChild variant="outline">
						<Link href="/settings/subscription">{t("upgrade")}</Link>
					</Button>
				</div>
			) : null}
			{board.isPending ? (
				<TableGridSkeleton />
			) : tables.length === 0 ? (
				<EmptyState
					icon={UtensilsCrossed}
					title={t("empty.title")}
					description={can("settings:manage") ? t("empty.hint") : t("empty.hintNoAccess")}
					action={
						can("settings:manage") ? (
							<Button asChild size="lg" className="brand-gradient">
								<Link href="/settings/tables">
									<Plus />
									{t("empty.action")}
								</Link>
							</Button>
						) : null
					}
				/>
			) : (
				<>
					<Segmented
						className="w-fit"
						value={filter}
						onChange={setFilter}
						options={[
							{ value: "all", label: t("filter.all", { count: tables.length }) },
							{ value: "free", label: <FilterLabel dot="bg-success">{t("filter.free", { count: free })}</FilterLabel> },
							{
								value: "occupied",
								label: <FilterLabel dot="bg-chart-4">{t("filter.occupied", { count: occupied })}</FilterLabel>,
							},
							...(waiting > 0
								? [
										{
											value: "waiting" as const,
											label: <FilterLabel dot="bg-warning">{t("filter.waiting", { count: waiting })}</FilterLabel>,
										},
									]
								: []),
						]}
					/>
					{zones.map(([zone, all], zoneIndex) => {
						const list = all.filter(shown);
						if (list.length === 0) return null;
						return (
					<section key={zone} className="space-y-3">
						{zones.length > 1 ? (
							<h2 className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-sm">
								<span className="size-2 rounded-full" style={{ background: ZONE_COLORS[zoneIndex % ZONE_COLORS.length] }} aria-hidden />
								{zone || t("noZone")}
								<span className="font-normal text-muted-foreground text-xs">{t("zoneCount", { count: all.length })}</span>
								<ZoneSplit tables={all} />
							</h2>
						) : null}
						<div className="grid grid-cols-2 gap-3 tablet:grid-cols-4 desktop:grid-cols-5 desktop:gap-4">
							{list.map((table) => (
								<TableCard
									key={table.id}
									table={table}
									now={now}
									onSelect={() => (table.tab ? setSession(table.tab.id) : setOpening(table))}
								/>
							))}
						</div>
					</section>
						);
					})}
				</>
			)}

			<OpenTableDialog
				key={`open:${opening?.id ?? ""}`}
				table={opening}
				onOpenChange={(open) => !open && setOpening(null)}
				onOpened={(tab) => {
					setOpening(null);
					setSession(tab.id);
				}}
			/>
			<TabSheet key={`tab:${sessionId ?? ""}`} sessionId={sessionId} onClose={() => setSession(null)} />
		</PageContainer>
	);
}
