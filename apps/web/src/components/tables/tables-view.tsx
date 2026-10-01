"use client";

import { ConfirmDialog } from "@/components/common/controls";
import { EmptyState, PageContainer, PageHeader, StatusBadge } from "@/components/common/primitives";
import { type CompletedPayment, CheckoutDialog } from "@/components/pos/checkout-dialog";
import { DiscountControl } from "@/components/pos/discount-control";
import { TableQrDialog } from "@/components/tables/table-qr";
import { TableGridSkeleton } from "@/components/tables/tables-skeletons";
import { useTab, useTabMutations, useTableBoard } from "@/hooks/use-posly";
import { useNow } from "@/hooks/use-now";
import { useActiveBusiness } from "@/hooks/use-workspace";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import type { BoardTableDto, TabDto, TableRequestDto } from "@/lib/api/posly";
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
import { Skeleton } from "@posly/ui/components/skeleton";
import { formatClock } from "@posly/utils/format";
import { addedTax, formatBaht, includedTax, type Satang } from "@posly/utils/money";
import { Ban, Check, Minus, MoreHorizontal, Plus, QrCode, ReceiptText, Settings2, UtensilsCrossed, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
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

function TableCard({ table, now, onSelect }: { table: BoardTableDto; now: Date; onSelect: () => void }) {
	const t = useTranslations("tables");
	const tKitchen = useTranslations("kitchen");
	const tab = table.tab;
	const waiting = tab?.pendingRequests ?? 0;
	return (
		<button
			type="button"
			onClick={onSelect}
			disabled={!table.isActive && !tab}
			className={cn(
				"surface surface-hover flex min-h-32 flex-col gap-2 rounded-2xl p-4 text-left transition-shadow",
				waiting > 0 && "ring-2 ring-warning",
				!table.isActive && !tab && "opacity-60"
			)}
		>
			<span className="flex items-start justify-between gap-2">
				<span className="font-semibold text-lg leading-tight">{table.name}</span>
				{waiting > 0 ? (
					<span className="relative flex size-2.5 shrink-0">
						<span className="absolute inline-flex size-full animate-ping rounded-full bg-warning opacity-70" />
						<span className="relative inline-flex size-2.5 rounded-full bg-warning" />
					</span>
				) : null}
			</span>
			{tab ? (
				<>
					<span className="numeric font-bold text-xl tracking-tight">{formatBaht(tab.total)}</span>
					<span className="mt-auto flex flex-wrap items-center gap-1.5">
						{waiting > 0 ? (
							<StatusBadge tone="warning">{t("newRequests", { count: waiting })}</StatusBadge>
						) : (
							<StatusBadge tone="info" dot>
								{t("occupied")}
							</StatusBadge>
						)}
						<span className="numeric text-muted-foreground text-xs" suppressHydrationWarning>
							{[tab.guests ? t("guests", { count: tab.guests }) : null, tKitchen("minutes", { count: minutesSince(tab.openedAt, now) })]
								.filter(Boolean)
								.join(" · ")}
						</span>
					</span>
				</>
			) : (
				<span className="mt-auto">
					<StatusBadge tone="neutral">{table.isActive ? t("free") : t("inactive")}</StatusBadge>
				</span>
			)}
		</button>
	);
}

function OpenTableDialog({ table, onOpenChange, onOpened }: { table: BoardTableDto | null; onOpenChange: (open: boolean) => void; onOpened: (tab: TabDto) => void }) {
	const t = useTranslations("tables.open");
	const tPos = useTranslations("pos");
	const { open } = useTabMutations();
	const [guests, setGuests] = useState(0);

	return (
		<Dialog open={table !== null} onOpenChange={onOpenChange}>
			<DialogContent className="gap-6 p-6 sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{table ? t("title", { table: table.name }) : null}</DialogTitle>
					<DialogDescription>{t("description")}</DialogDescription>
				</DialogHeader>
				<div className="space-y-2.5">
					<p className="font-medium text-sm">{t("guests")}</p>
					<div className="flex items-center gap-3">
						<Button variant="outline" size="icon-lg" className="size-11 rounded-xl" aria-label={tPos("decrease")} disabled={guests === 0} onClick={() => setGuests((g) => Math.max(0, g - 1))}>
							<Minus />
						</Button>
						<span className="numeric w-12 text-center font-semibold text-2xl">{guests || "—"}</span>
						<Button variant="outline" size="icon-lg" className="size-11 rounded-xl" aria-label={tPos("increase")} disabled={guests >= 99} onClick={() => setGuests((g) => Math.min(99, g + 1))}>
							<Plus />
						</Button>
					</div>
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
										onOpened(tab);
									},
									onError: (e) => toast.error(e.message),
								}
							)
						}
					>
						{t("confirm")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function RequestCard({ request }: { request: TableRequestDto }) {
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
					onClick={() => reject.mutate(request.id, { onSuccess: () => toast(t("rejected")), onError })}
				>
					<X />
					{t("reject")}
				</Button>
				<Button
					className="h-11 flex-[2] tablet:h-9"
					disabled={busy}
					onClick={() => accept.mutate(request.id, { onSuccess: () => toast.success(t("accepted")), onError })}
				>
					<Check />
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
	const [discount, setDiscount] = useState<Discount | null>(null);
	const [paying, setPaying] = useState(false);
	const [cancelling, setCancelling] = useState(false);
	const [showQr, setShowQr] = useState(false);
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
								{pending.length > 0 ? (
									<section className="space-y-2">
										<h3 className="font-semibold text-sm">
											{t("requests")} · {pending.length}
										</h3>
										<ul className="space-y-2">
											{pending.map((r) => (
												<RequestCard key={r.id} request={r} />
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
									<DropdownMenuContent align="start" side="top">
										{table ? (
											<DropdownMenuItem onClick={() => setShowQr(true)}>
												<QrCode />
												{t("showQr")}
											</DropdownMenuItem>
										) : null}
										<DropdownMenuSeparator />
										<DropdownMenuItem variant="destructive" onClick={() => setCancelling(true)}>
											<Ban />
											{t("cancelTab")}
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
								<Button variant="outline" className="h-12 flex-1 rounded-xl" onClick={addItems}>
									<Plus />
									{t("add")}
								</Button>
								<Button
									className="brand-gradient h-12 flex-1 rounded-xl font-semibold"
									disabled={!data.orderId || pending.length > 0}
									onClick={() => setPaying(true)}
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
	const board = useTableBoard();
	const now = useNow(30_000);
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const sessionId = searchParams.get("tab");
	const [opening, setOpening] = useState<BoardTableDto | null>(null);

	const setSession = (id: string | null) =>
		router.replace(id ? { pathname, query: { tab: id } } : pathname, { scroll: false });

	const tables = useMemo(() => board.data ?? [], [board.data]);
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

	return (
		<PageContainer>
			<PageHeader
				title={t("title")}
				description={tables.length ? t("summary", { free, occupied }) : t("description")}
				actions={
					can("settings:manage") ? (
						<Button asChild variant="outline">
							<Link href="/settings/tables">
								<Settings2 />
								{t("manage")}
							</Link>
						</Button>
					) : null
				}
			/>

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
				zones.map(([zone, list]) => (
					<section key={zone} className="space-y-3">
						{zones.length > 1 ? <h2 className="font-semibold text-muted-foreground text-sm">{zone || t("noZone")}</h2> : null}
						<div className="grid grid-cols-2 gap-3 tablet:grid-cols-3 desktop:grid-cols-5">
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
				))
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
