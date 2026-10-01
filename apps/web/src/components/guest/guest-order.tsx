"use client";

import { Segmented } from "@/components/common/controls";
import { EmptyState, StatusBadge } from "@/components/common/primitives";
import { ProductThumb } from "@/components/common/product-thumb";
import { StoreAvatar } from "@/components/layout/brand";
import { ModifierDialog } from "@/components/pos/modifier-dialog";
import { type GuestProductDto, guestApi } from "@/lib/api/guest";
import type { TableCallKind } from "@/lib/api/posly";
import { BackendError } from "@/lib/api/backend";
import { cn } from "@/lib/utils";
import type { OrderItemModifier, Product } from "@posly/types/domain";
import { Button } from "@posly/ui/components/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@posly/ui/components/sheet";
import { Skeleton } from "@posly/ui/components/skeleton";
import { formatBaht, multiply, sum } from "@posly/utils/money";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, HandPlatter, Loader2, Minus, Plus, ReceiptText, RotateCcw, SearchX, ShoppingBasket, Store, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

interface GuestLine {
	key: string;
	productId: string;
	name: string;
	unitPrice: number;
	quantity: number;
	modifiers: OrderItemModifier[];
	note: string | null;
}

const ALL = "all";
const lineKey = (productId: string, modifiers: OrderItemModifier[], note: string | null) =>
	[productId, ...modifiers.map((m) => m.optionId ?? m.optionName).sort(), note ?? ""].join("|");

/** The modifier dialog speaks the POS's product shape; a guest's product carries only what it needs. */
const asProduct = (p: GuestProductDto): Product => ({
	id: p.id,
	name: p.name,
	categoryId: p.categoryId ?? "",
	price: p.price,
	cost: null,
	sku: null,
	barcode: null,
	art: p.art,
	imageUrl: p.imageUrl,
	trackStock: false,
	stock: null,
	lowStockAt: null,
	unit: "",
	isActive: true,
	modifierGroups: p.modifierGroups.map((g) => ({
		id: g.id,
		name: g.name,
		selection: g.selection,
		required: g.required,
		options: g.options.map((o) => ({ id: o.id, name: o.name, priceDelta: o.priceDelta })),
		defaultOptionId: g.options.find((o) => o.isDefault)?.id,
	})),
});

/**
 * A guest's picks survive a reload or a locked phone: kept per table in localStorage, read
 * through an external store so the server render (always empty) and the first client render agree.
 */
const EMPTY: GuestLine[] = [];
const carts = new Map<string, GuestLine[]>();
const cartListeners = new Set<() => void>();
const subscribeCart = (notify: () => void) => {
	cartListeners.add(notify);
	return () => cartListeners.delete(notify);
};
const readCart = (key: string): GuestLine[] => {
	let lines = carts.get(key);
	if (!lines) {
		try {
			lines = JSON.parse(localStorage.getItem(key) ?? "[]") as GuestLine[];
		} catch {
			// Private mode or a bad value: start empty.
			lines = EMPTY;
		}
		carts.set(key, lines);
	}
	return lines;
};
const writeCart = (key: string, lines: GuestLine[]) => {
	carts.set(key, lines);
	try {
		localStorage.setItem(key, JSON.stringify(lines));
	} catch {
		// Not stored; the cart still works for this visit.
	}
	for (const notify of cartListeners) notify();
};

const useStoredCart = (token: string) => {
	const key = `posly:guest-cart:${token}`;
	const lines = useSyncExternalStore(
		subscribeCart,
		() => readCart(key),
		() => EMPTY
	);
	const update = (next: GuestLine[] | ((current: GuestLine[]) => GuestLine[])) =>
		writeCart(key, typeof next === "function" ? next(readCart(key)) : next);
	return [lines, update] as const;
};

function GuestBill({
	token,
	tableOpen,
	open,
	onOpenChange,
}: {
	token: string;
	tableOpen: boolean;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const t = useTranslations("guest");
	// A room of phones often shares one Wi-Fi address: poll quickly only while the bill is on screen.
	const tab = useQuery({
		queryKey: ["guest", token, "tab"],
		queryFn: ({ signal }) => guestApi.tab(token, signal),
		enabled: tableOpen,
		refetchInterval: open ? 5000 : 60_000,
	});
	const data = tab.data;
	const waiting = data?.requests.filter((r) => r.status === "PENDING") ?? [];
	const rejected = data?.requests.filter((r) => r.status === "REJECTED") ?? [];
	const rounds = useMemo(() => {
		const byRound = new Map<number, NonNullable<typeof data>["lines"]>();
		for (const line of data?.lines ?? []) byRound.set(line.round, [...(byRound.get(line.round) ?? []), line]);
		return [...byRound.entries()];
	}, [data?.lines]);

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="bottom" showCloseButton={false} className="max-h-[88svh] gap-0 rounded-t-3xl p-0">
				<SheetHeader className="px-5 pt-5 pb-2">
					<SheetTitle className="font-semibold text-lg">{t("bill")}</SheetTitle>
					<SheetDescription>{t("billHint")}</SheetDescription>
				</SheetHeader>
				<div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-3">
					{waiting.map((r) => (
						<div key={r.id} className="space-y-1.5 rounded-2xl bg-warning/10 p-3.5 ring-1 ring-warning/40">
							<p className="flex items-center gap-2 font-medium text-xs">
								<span className="size-2 rounded-full bg-warning" aria-hidden />
								{t("waiting")}
							</p>
							{r.items.map((item, i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: a request's lines never reorder
								<p key={i} className="text-sm">
									<span className="numeric font-semibold">{item.quantity}×</span> {item.name}
								</p>
							))}
						</div>
					))}
					{rejected.map((r) => (
						<p key={r.id} className="flex items-start gap-2 rounded-2xl bg-danger/10 p-3.5 text-danger text-sm">
							<TriangleAlert className="mt-0.5 size-4 shrink-0" />
							<span>
								{t("rejected")}: {r.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
							</span>
						</p>
					))}
					{tab.isPending ? (
						<Skeleton className="h-24 w-full rounded-2xl" />
					) : rounds.length === 0 && waiting.length === 0 ? (
						<EmptyState icon={ReceiptText} title={t("billEmpty")} className="py-8" />
					) : (
						rounds.map(([round, lines]) => (
							<section key={round} className="space-y-1">
								<h3 className="font-semibold text-muted-foreground text-xs">{t("round", { round })}</h3>
								<ul className="divide-y">
									{lines.map((line, i) => (
										// biome-ignore lint/suspicious/noArrayIndexKey: the bill's lines never reorder
										<li key={i} className="flex gap-2 py-2 text-sm">
											<span className="numeric shrink-0 font-semibold">{line.quantity}×</span>
											<span className="min-w-0 flex-1">
												<span className="block font-medium">{line.name}</span>
												{line.modifiers.length ? <span className="block text-muted-foreground text-xs">{line.modifiers.join(" · ")}</span> : null}
												<span className="mt-1 flex items-center gap-1 text-muted-foreground text-xs">
													<span className={cn("size-1.5 rounded-full", line.ready ? "bg-success" : "bg-warning")} aria-hidden />
													{line.ready ? t("ready") : t("cooking")}
												</span>
											</span>
											<span className="numeric shrink-0">{formatBaht(line.lineTotal)}</span>
										</li>
									))}
								</ul>
							</section>
						))
					)}
				</div>
				<div className="space-y-3 border-t px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
					<div className="flex items-baseline justify-between">
						<span className="font-semibold">{t("billTotal")}</span>
						<span className="numeric font-bold text-2xl tracking-tight">{formatBaht(data?.total ?? 0)}</span>
					</div>
					<Button variant="outline" size="lg" className="h-11 w-full" onClick={() => onOpenChange(false)}>
						{t("close")}
					</Button>
				</div>
			</SheetContent>
		</Sheet>
	);
}

/**
 * What a guest sees after scanning a table's QR: the shop's menu, a basket, and the table's
 * bill. A round goes to staff to accept, not straight to the kitchen; the table must be open.
 * Built for one hand on a phone — nothing here needs a login.
 */
export function GuestOrder({ token }: { token: string }) {
	const t = useTranslations("guest");
	const tPos = useTranslations("pos");
	const menu = useQuery({
		queryKey: ["guest", token, "menu"],
		queryFn: ({ signal }) => guestApi.menu(token, signal),
		// Whether the table is open changes while they read the menu.
		refetchInterval: 30_000,
		retry: (count, error) => !(error instanceof BackendError && error.status === 404) && count < 2,
	});
	const [lines, setLines] = useStoredCart(token);
	const [category, setCategory] = useState(ALL);
	const [customising, setCustomising] = useState<Product | null>(null);
	const [cartOpen, setCartOpen] = useState(false);
	const [billOpen, setBillOpen] = useState(false);
	const [requestId, setRequestId] = useState(() => crypto.randomUUID());

	const data = menu.data;
	const products = useMemo(
		() => (data?.products ?? []).filter((p) => category === ALL || p.categoryId === category),
		[data?.products, category]
	);
	const count = lines.reduce((n, l) => n + l.quantity, 0);
	const total = sum(...lines.map((l) => multiply(l.unitPrice, l.quantity)));

	const add = (product: Product, modifiers: OrderItemModifier[] = [], note: string | null = null) => {
		const key = lineKey(product.id, modifiers, note);
		const unitPrice = sum(product.price, ...modifiers.map((m) => m.priceDelta));
		setLines((current) =>
			current.some((l) => l.key === key)
				? current.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l))
				: [...current, { key, productId: product.id, name: product.name, unitPrice, quantity: 1, modifiers, note }]
		);
	};
	const change = (key: string, by: number) =>
		setLines((current) => current.map((l) => (l.key === key ? { ...l, quantity: l.quantity + by } : l)).filter((l) => l.quantity > 0));

	// The bill can be asked for once something is on it; the same query the bill sheet polls.
	const guestTab = useQuery({
		queryKey: ["guest", token, "tab"],
		queryFn: ({ signal }) => guestApi.tab(token, signal),
		enabled: Boolean(data?.open),
		refetchInterval: 60_000,
	});
	const hasBill = (guestTab.data?.lines.length ?? 0) > 0;
	// A call is answered by staff walking over, not on screen: the button rests for a minute.
	const [called, setCalled] = useState<Partial<Record<TableCallKind, boolean>>>({});
	const callStaff = useMutation({
		mutationFn: (kind: TableCallKind) => guestApi.call(token, kind),
		onSuccess: (_, kind) => {
			toast.success(kind === "BILL" ? t("billToast") : t("calledToast"));
			setCalled((c) => ({ ...c, [kind]: true }));
			window.setTimeout(() => setCalled((c) => ({ ...c, [kind]: false })), 60_000);
		},
		onError: (e) => toast.error(e.message),
	});

	const send = useMutation({
		mutationFn: () =>
			guestApi.send(
				token,
				requestId,
				lines.map((l) => ({
					productId: l.productId,
					quantity: l.quantity,
					modifierOptionIds: l.modifiers.flatMap((m) => (m.optionId ? [m.optionId] : [])),
					note: l.note ?? undefined,
				}))
			),
		onSuccess: () => {
			toast.success(t("sent"));
			setLines([]);
			setRequestId(crypto.randomUUID());
			setCartOpen(false);
			setBillOpen(true);
		},
		onError: (e) => {
			toast.error(e.message);
			void menu.refetch();
		},
	});

	if (menu.isError && menu.error instanceof BackendError && menu.error.status === 404) {
		return (
			<main className="flex min-h-svh items-center justify-center px-4">
				<EmptyState icon={SearchX} title={t("notFoundTitle")} description={t("notFoundHint")} />
			</main>
		);
	}
	if (menu.isError) {
		return (
			<main className="flex min-h-svh items-center justify-center px-4">
				<EmptyState
					icon={TriangleAlert}
					title={t("error")}
					action={
						<Button size="lg" onClick={() => void menu.refetch()}>
							<RotateCcw />
							{t("retry")}
						</Button>
					}
				/>
			</main>
		);
	}

	return (
		<main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col bg-background pb-28">
			{/* Sticky, with a backdrop that runs up past the top: in-app browsers scroll content over it. */}
			<header className="sticky top-0 z-20 bg-background/95 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 backdrop-blur before:absolute before:inset-x-0 before:bottom-full before:h-screen before:bg-background">
				<div className="flex items-center gap-3">
					{data ? (
						<StoreAvatar name={data.shopName} logoUrl={data.logoUrl} className="size-10" />
					) : (
						<Skeleton className="size-10 rounded-xl" />
					)}
					<div className="min-w-0 flex-1">
						{data ? (
							<>
								<p className="truncate font-semibold text-base leading-tight">{data.shopName}</p>
								<p className="truncate text-muted-foreground text-sm">{data.tableName}</p>
							</>
						) : (
							<>
								<Skeleton className="h-5 w-32" />
								<Skeleton className="mt-1 h-4 w-16" />
							</>
						)}
					</div>
					<Button variant="outline" className="h-11 rounded-xl" onClick={() => setBillOpen(true)} disabled={!data?.open}>
						<ReceiptText />
						{t("bill")}
					</Button>
				</div>
				{data && data.categories.length > 0 ? (
					<Segmented
						variant="chips"
						size="lg"
						className="mt-3"
						value={category}
						onChange={setCategory}
						options={[{ value: ALL, label: t("all") }, ...data.categories.map((c) => ({ value: c.id, label: c.name }))]}
					/>
				) : null}
			</header>

			{data && !data.qrOrdering ? (
				<div className="mx-4 mt-2 flex items-start gap-3 rounded-2xl bg-muted p-4">
					<Store className="mt-0.5 size-5 shrink-0" />
					<div>
						<p className="font-semibold text-sm">{t("noQrTitle")}</p>
						<p className="text-muted-foreground text-sm">{t("noQrHint")}</p>
					</div>
				</div>
			) : data && !data.open ? (
				<div className="mx-4 mt-2 flex items-start gap-3 rounded-2xl bg-warning/12 p-4">
					<TriangleAlert className="mt-0.5 size-5 shrink-0" />
					<div>
						<p className="font-semibold text-sm">{t("closedTitle")}</p>
						<p className="text-muted-foreground text-sm">{t("closedHint")}</p>
					</div>
				</div>
			) : null}

			{data?.qrOrdering ? (
				<div className="mx-4 mt-3 grid grid-cols-2 gap-2">
					<Button
						variant="outline"
						className="h-11 rounded-xl"
						disabled={called.WAITER || callStaff.isPending}
						onClick={() => callStaff.mutate("WAITER")}
					>
						{called.WAITER ? <Check /> : <HandPlatter />}
						{called.WAITER ? t("called") : t("callWaiter")}
					</Button>
					<Button
						variant="outline"
						className="h-11 rounded-xl"
						disabled={!hasBill || called.BILL || callStaff.isPending}
						onClick={() => callStaff.mutate("BILL")}
					>
						{called.BILL ? <Check /> : <ReceiptText />}
						{called.BILL ? t("called") : t("askBill")}
					</Button>
				</div>
			) : null}

			<ul className="grid gap-2 px-4 pt-3">
				{menu.isPending
					? Array.from({ length: 6 }, (_, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
							<Skeleton key={i} className="h-24 w-full rounded-2xl" />
						))
					: products.map((p) => {
							const inCart = lines.filter((l) => l.productId === p.id).reduce((n, l) => n + l.quantity, 0);
							const disabled = !data?.open || p.soldOut;
							return (
								<li key={p.id}>
									<button
										type="button"
										disabled={disabled}
										onClick={() => (p.modifierGroups.length ? setCustomising(asProduct(p)) : add(asProduct(p)))}
										aria-label={t("add", { name: p.name })}
										className={cn(
											"surface flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors",
											!disabled && "surface-hover active:bg-muted/60",
											p.soldOut && "opacity-60"
										)}
									>
										<ProductThumb art={p.art} imageUrl={p.imageUrl} name={p.name} className="size-18 shrink-0" />
										<span className="min-w-0 flex-1">
											<span className="block font-medium">{p.name}</span>
											<span className="numeric mt-0.5 block text-muted-foreground text-sm">{formatBaht(p.price)}</span>
										</span>
										{p.soldOut ? (
											<StatusBadge tone="neutral">{t("soldOut")}</StatusBadge>
										) : data?.open ? (
											<span
												className={cn(
													"flex size-11 shrink-0 items-center justify-center rounded-xl font-semibold",
													inCart ? "bg-primary text-primary-foreground" : "bg-accent text-primary"
												)}
											>
												{inCart ? <span className="numeric">{inCart}</span> : <Plus className="size-5" />}
											</span>
										) : null}
									</button>
								</li>
							);
						})}
			</ul>
			<p className="mt-8 text-center text-muted-foreground text-xs">{t("poweredBy")}</p>

			{count > 0 ? (
				<div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
					<Button onClick={() => setCartOpen(true)} className="brand-gradient h-14 w-full rounded-2xl px-4 font-semibold text-base shadow-lg">
						<span className="flex size-7 items-center justify-center rounded-lg bg-white/20">
							<ShoppingBasket className="size-4" />
						</span>
						<span className="flex-1 text-left">{t("viewCart", { count })}</span>
						<span className="numeric">{formatBaht(total)}</span>
					</Button>
				</div>
			) : null}

			<Sheet open={cartOpen} onOpenChange={setCartOpen}>
				<SheetContent side="bottom" showCloseButton={false} className="max-h-[88svh] gap-0 rounded-t-3xl p-0">
					<SheetHeader className="px-5 pt-5 pb-2">
						<SheetTitle className="font-semibold text-lg">{t("cart")}</SheetTitle>
						<SheetDescription>{t("cartHint")}</SheetDescription>
					</SheetHeader>
					<ul className="min-h-0 flex-1 divide-y overflow-y-auto px-5">
						{lines.map((line) => (
							<li key={line.key} className="flex items-center gap-3 py-3">
								<span className="min-w-0 flex-1">
									<span className="block font-medium text-sm">{line.name}</span>
									{line.modifiers.length || line.note ? (
										<span className="block text-muted-foreground text-xs">
											{[...line.modifiers.map((m) => m.optionName), line.note ? `“${line.note}”` : null].filter(Boolean).join(" · ")}
										</span>
									) : null}
									<span className="numeric block text-muted-foreground text-xs">{formatBaht(multiply(line.unitPrice, line.quantity))}</span>
								</span>
								<span className="flex items-center gap-1">
									<Button variant="outline" size="icon-lg" className="size-11 rounded-xl" aria-label={tPos("decrease")} onClick={() => change(line.key, -1)}>
										<Minus />
									</Button>
									<span className="numeric w-8 text-center font-semibold">{line.quantity}</span>
									<Button variant="outline" size="icon-lg" className="size-11 rounded-xl" aria-label={tPos("increase")} onClick={() => change(line.key, 1)}>
										<Plus />
									</Button>
								</span>
							</li>
						))}
					</ul>
					<div className="flex gap-2 border-t px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
						<Button variant="outline" size="lg" className="h-13 rounded-xl px-5" onClick={() => setCartOpen(false)}>
							{t("close")}
						</Button>
						<Button
							size="lg"
							className="brand-gradient h-13 min-w-0 flex-1 rounded-xl font-semibold text-base"
							disabled={lines.length === 0 || send.isPending || !data?.open}
							onClick={() => send.mutate()}
						>
							{send.isPending ? <Loader2 className="animate-spin" /> : null}
							{t("send", { total: formatBaht(total) })}
						</Button>
					</div>
				</SheetContent>
			</Sheet>

			<ModifierDialog
				product={customising}
				onOpenChange={(open) => !open && setCustomising(null)}
				onConfirm={(product, modifiers, note) => {
					add(product, modifiers, note);
					setCustomising(null);
				}}
			/>
			<GuestBill token={token} tableOpen={Boolean(data?.open)} open={billOpen} onOpenChange={setBillOpen} />
		</main>
	);
}
