"use client";

import { type CompletedPayment, CheckoutDialog } from "@/components/pos/checkout-dialog";
import { DiscountControl } from "@/components/pos/discount-control";
import { useTabMutations } from "@/hooks/use-posly";
import { useActiveBusiness } from "@/hooks/use-workspace";
import type { BoardTableDto, TabDto } from "@/lib/api/posly";
import { cn } from "@/lib/utils";
import { type CartTotals, type Discount, resolveDiscount } from "@/stores/cart-store";
import type { PaymentMethod } from "@posly/types/domain";
import { Button } from "@posly/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@posly/ui/components/dialog";
import { addedTax, formatBaht, includedTax, type Satang } from "@posly/utils/money";
import { Loader2, Minus, Plus, ReceiptText, UtensilsCrossed } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

/** A table to pick, as a chip: its name, and its bill when it has one. */
function TableChoice({
	table,
	selected,
	onSelect,
}: {
	table: BoardTableDto;
	selected: boolean;
	onSelect: () => void;
}) {
	return (
		<button
			type="button"
			role="radio"
			aria-checked={selected}
			onClick={onSelect}
			className={cn(
				"flex min-h-14 flex-col items-start justify-center rounded-xl px-3 py-2 text-left ring-1 transition-colors",
				selected ? "bg-accent font-medium text-accent-foreground ring-primary" : "bg-card ring-border hover:bg-muted"
			)}
		>
			<span className="font-semibold text-sm">{table.name}</span>
			{table.tab ? <span className="numeric text-muted-foreground text-xs">{formatBaht(table.tab.total)}</span> : null}
		</button>
	);
}

/** Move the whole tab to a free table in the same branch. */
export function MoveTabDialog({
	open,
	onOpenChange,
	tab,
	tables,
	branchId,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	tab: TabDto;
	tables: BoardTableDto[];
	branchId: string;
}) {
	const t = useTranslations("tables.actions");
	const { move } = useTabMutations();
	const [target, setTarget] = useState<string | null>(null);
	const free = tables.filter((x) => !x.tab && x.isActive && x.branchId === branchId && x.id !== tab.tableId);
	const chosen = free.find((x) => x.id === target);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="gap-6 p-6 sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{t("moveTitle", { table: tab.tableName })}</DialogTitle>
					<DialogDescription>{t("moveHint")}</DialogDescription>
				</DialogHeader>
				{free.length === 0 ? (
					<p className="rounded-xl bg-muted/60 px-4 py-6 text-center text-muted-foreground text-sm">{t("moveNone")}</p>
				) : (
					<div role="radiogroup" className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto p-0.5">
						{free.map((x) => (
							<TableChoice key={x.id} table={x} selected={target === x.id} onSelect={() => setTarget(x.id)} />
						))}
					</div>
				)}
				<DialogFooter className="-mx-6 -mb-6 mt-2 px-6 py-4">
					<Button variant="outline" size="lg" onClick={() => onOpenChange(false)}>
						{t("cancel")}
					</Button>
					<Button
						size="lg"
						className="brand-gradient"
						disabled={!chosen || move.isPending}
						onClick={() =>
							chosen &&
							move.mutate(
								{ sessionId: tab.id, tableId: chosen.id },
								{
									onSuccess: () => {
										toast.success(t("moved", { table: chosen.name }));
										onOpenChange(false);
									},
									onError: (e) => toast.error(e.message),
								}
							)
						}
					>
						{move.isPending ? <Loader2 className="animate-spin" /> : <UtensilsCrossed />}
						{chosen ? t("moveTo", { table: chosen.name }) : t("move")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** Bring another open tab's lines onto this one; that table is freed. */
export function MergeTabDialog({
	open,
	onOpenChange,
	tab,
	tables,
	branchId,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	tab: TabDto;
	tables: BoardTableDto[];
	branchId: string;
}) {
	const t = useTranslations("tables.actions");
	const { merge } = useTabMutations();
	const [other, setOther] = useState<string | null>(null);
	const openTabs = tables.filter((x) => x.tab && x.tab.id !== tab.id && x.branchId === branchId);
	const chosen = openTabs.find((x) => x.tab?.id === other);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="gap-6 p-6 sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{t("mergeTitle", { table: tab.tableName })}</DialogTitle>
					<DialogDescription>{t("mergeHint")}</DialogDescription>
				</DialogHeader>
				{openTabs.length === 0 ? (
					<p className="rounded-xl bg-muted/60 px-4 py-6 text-center text-muted-foreground text-sm">{t("mergeNone")}</p>
				) : (
					<div role="radiogroup" className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto p-0.5">
						{openTabs.map((x) => (
							<TableChoice
								key={x.id}
								table={x}
								selected={other === x.tab?.id}
								onSelect={() => setOther(x.tab?.id ?? null)}
							/>
						))}
					</div>
				)}
				<DialogFooter className="-mx-6 -mb-6 mt-2 px-6 py-4">
					<Button variant="outline" size="lg" onClick={() => onOpenChange(false)}>
						{t("cancel")}
					</Button>
					<Button
						size="lg"
						className="brand-gradient"
						disabled={!chosen || merge.isPending}
						onClick={() =>
							chosen?.tab &&
							merge.mutate(
								{ sessionId: tab.id, otherSessionId: chosen.tab.id },
								{
									onSuccess: () => {
										toast.success(t("merged", { other: chosen.name, table: tab.tableName }));
										onOpenChange(false);
									},
									onError: (e) => toast.error(e.message),
								}
							)
						}
					>
						{merge.isPending ? <Loader2 className="animate-spin" /> : null}
						{chosen ? t("mergeConfirm", { other: chosen.name }) : t("merge")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** Totals for the chosen part of the tab: the same arithmetic as the till and the API. */
const partTotals = (
	lines: { unitPrice: Satang; quantity: number }[],
	discount: Discount | null,
	vatBasisPoints: number,
	pricesIncludeVat: boolean
): CartTotals => {
	const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
	const off = resolveDiscount(discount, subtotal);
	const taxable = subtotal - off;
	const vat = pricesIncludeVat ? includedTax(taxable, vatBasisPoints) : addedTax(taxable, vatBasisPoints);
	return {
		itemCount: lines.reduce((n, l) => n + l.quantity, 0),
		subtotal,
		discount: off,
		vat,
		total: pricesIncludeVat ? taxable : taxable + vat,
	};
};

/**
 * Pay part of the tab now: pick lines and how many of each, then take the payment with the
 * till's own check-out. What is left stays on the tab.
 */
export function SplitTabDialog({
	open,
	onOpenChange,
	tab,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	tab: TabDto;
}) {
	const t = useTranslations("tables.actions");
	const tPos = useTranslations("pos");
	const { business, can } = useActiveBusiness();
	const { split } = useTabMutations();
	const [picked, setPicked] = useState<Record<string, number>>({});
	const [discount, setDiscount] = useState<Discount | null>(null);
	const [paying, setPaying] = useState(false);
	// One id per split: a retry after a timeout returns the same order instead of charging twice.
	const [clientOrderId, setClientOrderId] = useState(() => crypto.randomUUID());

	const chosen = useMemo(
		() =>
			tab.lines
				.filter((l) => (picked[l.id] ?? 0) > 0)
				.map((l) => ({ ...l, quantity: picked[l.id] as number })),
		[tab.lines, picked]
	);
	const totals = partTotals(chosen, discount, business.vatBasisPoints, business.pricesIncludeVat);
	const everything = tab.lines.every((l) => (picked[l.id] ?? 0) >= l.quantity);
	const change = (lineId: string, by: number, max: number) =>
		setPicked((p) => ({ ...p, [lineId]: Math.min(max, Math.max(0, (p[lineId] ?? 0) + by)) }));

	const pay = async (method: PaymentMethod, received: Satang | null): Promise<CompletedPayment> => {
		const order = await split.mutateAsync({
			sessionId: tab.id,
			clientOrderId,
			items: chosen.map((l) => ({ itemId: l.id, quantity: l.quantity })),
			discount: totals.discount,
			payment: { method, received: received ?? undefined },
		});
		toast.success(t("splitDone"));
		return { order, method: order.paymentMethod, total: order.total, received: order.received, change: order.change, orderNumber: order.number };
	};

	const done = () => {
		setPaying(false);
		setPicked({});
		setDiscount(null);
		setClientOrderId(crypto.randomUUID());
		onOpenChange(false);
	};

	return (
		<>
			<Dialog open={open && !paying} onOpenChange={onOpenChange}>
				<DialogContent className="gap-6 p-6 sm:max-w-md">
					<DialogHeader>
						<DialogTitle>{t("splitTitle", { table: tab.tableName })}</DialogTitle>
						<DialogDescription>{t("splitHint")}</DialogDescription>
					</DialogHeader>
					<ul className="-mx-2 max-h-80 divide-y overflow-y-auto px-2">
						{tab.lines.map((line) => {
							const n = picked[line.id] ?? 0;
							return (
								<li key={line.id} className="flex items-center gap-3 py-2.5">
									<span className="min-w-0 flex-1">
										<span className="block truncate font-medium text-sm">
											{line.quantity}× {line.name}
										</span>
										<span className="numeric block text-muted-foreground text-xs">
											{line.modifiers.length ? `${line.modifiers.join(" · ")} · ` : ""}
											{formatBaht(line.unitPrice)}
										</span>
									</span>
									<span className="flex items-center gap-1">
										<Button
											variant="outline"
											size="icon-lg"
											className="size-11 rounded-xl tablet:size-9"
											aria-label={tPos("decrease")}
											disabled={n === 0}
											onClick={() => change(line.id, -1, line.quantity)}
										>
											<Minus />
										</Button>
										<span className={cn("numeric w-8 text-center font-semibold", n === 0 && "text-muted-foreground")}>{n}</span>
										<Button
											variant="outline"
											size="icon-lg"
											className="size-11 rounded-xl tablet:size-9"
											aria-label={tPos("increase")}
											disabled={n >= line.quantity}
											onClick={() => change(line.id, 1, line.quantity)}
										>
											<Plus />
										</Button>
									</span>
								</li>
							);
						})}
					</ul>
					<dl className="numeric grid gap-1.5 rounded-2xl bg-muted/50 px-4 py-3 text-sm">
						{can("orders:discount") && totals.subtotal > 0 ? (
							<DiscountControl subtotal={totals.subtotal} off={totals.discount} value={discount} onChange={setDiscount} />
						) : null}
						<div className="flex items-baseline justify-between">
							<dt className="font-semibold">{t("splitTotal")}</dt>
							<dd className="font-bold text-xl">{formatBaht(totals.total)}</dd>
						</div>
					</dl>
					{everything ? <p className="text-center text-muted-foreground text-xs">{t("splitAll")}</p> : null}
					<DialogFooter className="-mx-6 -mb-6 mt-2 px-6 py-4">
						<Button variant="outline" size="lg" onClick={() => onOpenChange(false)}>
							{t("cancel")}
						</Button>
						<Button
							size="lg"
							className="brand-gradient"
							disabled={chosen.length === 0 || everything}
							onClick={() => setPaying(true)}
						>
							<ReceiptText />
							{t("splitPay", { total: formatBaht(totals.total) })}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<CheckoutDialog
				open={paying}
				onOpenChange={(next) => {
					if (!next) setPaying(false);
				}}
				totals={totals}
				sessionKey={clientOrderId}
				promptPayId={business.promptPayId}
				onPay={pay}
				doneLabel={t("splitBack")}
				doneIcon={ReceiptText}
				onNewOrder={done}
			/>
		</>
	);
}
