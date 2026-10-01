"use client";

import { addedTax, includedTax, multiply, type Satang, sum } from "@posly/utils/money";
import type { OrderItemModifier, Product, ServiceType } from "@posly/types/domain";
import { create } from "zustand";

export interface CartLine {
	/** Stable per line, not per product: the same Latte with two sweetness levels is two lines. */
	key: string;
	productId: string;
	name: string;
	art: Product["art"];
	unitPrice: Satang;
	quantity: number;
	modifiers: OrderItemModifier[];
	note: string | null;
}

/**
 * An order-level discount, kept as the cashier entered it. A percentage stays a percentage,
 * so 10% of the bill is still 10% after two more coffees are added; it resolves to satang
 * only in `computeTotals`, and that resolved amount is what checkout sends.
 */
export type Discount = { kind: "amount"; amount: Satang } | { kind: "percent"; basisPoints: number };

export const resolveDiscount = (discount: Discount | null, subtotal: Satang): Satang => {
	if (!discount) return 0;
	const raw =
		discount.kind === "percent"
			? Math.round((subtotal * Math.min(discount.basisPoints, 10_000)) / 10_000)
			: discount.amount;
	return Math.min(Math.max(0, raw), subtotal);
};

export type AddResult = "added" | "limit";

/** How many of a product are already in the cart, across every line (sizes, notes, …). */
export const quantityInCart = (lines: CartLine[], productId: string) =>
	lines.reduce((sum, line) => (line.productId === productId ? sum + line.quantity : sum), 0);

/** Room left on the shelf for one more, or null when the product does not track stock. */
export const remainingStock = (state: Pick<CartState, "lines" | "stock">, productId: string) => {
	const onShelf = state.stock[productId];
	return onShelf === undefined ? null : onShelf - quantityInCart(state.lines, productId);
};

interface CartState {
	lines: CartLine[];
	discount: Discount | null;
	/** The line the +/- keyboard shortcuts act on — the one most recently touched. */
	activeKey: string | null;
	/**
	 * Shelf stock per tracked product, from the latest menu the API returned. Untracked
	 * products are absent — they have no ceiling.
	 */
	stock: Record<string, number>;
	syncStock: (products: Pick<Product, "id" | "trackStock" | "stock">[]) => void;
	/** "limit" when the shelf has no more of it; the cart is left unchanged. */
	add: (product: Product, modifiers?: OrderItemModifier[], note?: string | null) => AddResult;
	increment: (key: string) => AddResult;
	decrement: (key: string) => void;
	remove: (key: string) => void;
	setNote: (key: string, note: string | null) => void;
	/** Makes a line the one +/- and the highlight act on, without changing it. */
	setActive: (key: string) => void;
	/**
	 * Re-picks a line's options (and note) in place. If that makes it identical to another
	 * line, the two merge, quantities added. Returns the line's key afterwards.
	 */
	updateLine: (key: string, modifiers: OrderItemModifier[], note: string | null) => string;
	setDiscount: (discount: Discount | null) => void;
	/** The customer this sale is for (plan §22); cleared with the cart. */
	customer: { id: string; name: string } | null;
	setCustomer: (customer: { id: string; name: string } | null) => void;
	/**
	 * Dine in / take away / delivery. Kept across sales — a counter serves runs of the same
	 * kind — while the label ("โต๊ะ 3") belongs to one order and clears with the cart.
	 */
	serviceType: ServiceType | null;
	setServiceType: (serviceType: ServiceType | null) => void;
	label: string;
	setLabel: (label: string) => void;
	/**
	 * The table tab this cart is filling, when staff came from the floor to add a round. The
	 * cart is then sent onto the tab instead of paid; clearing the cart keeps it attached.
	 */
	table: { sessionId: string; name: string } | null;
	setTable: (table: { sessionId: string; name: string } | null) => void;
	clear: () => void;
}

/**
 * Two lines are the same line only when product, modifiers and note all match, so tapping
 * Americano twice gives "Americano ×2" but a no-sugar Americano stays separate.
 */
const lineKey = (productId: string, modifiers: OrderItemModifier[], note: string | null) =>
	[
		productId,
		...modifiers.map((m) => `${m.groupName}:${m.optionName}`).sort(),
		note ?? "",
	].join("|");

/**
 * The POS cart.
 *
 * Kept in a client store rather than server state on purpose: a cart must keep working with
 * the network gone (plan §38). Nothing here calls the API; checkout turns the lines into an
 * order request, which is the only step that needs to become a sync-queue entry later.
 */
export const useCartStore = create<CartState>((set, get) => ({
	lines: [],
	discount: null,
	customer: null,
	serviceType: null,
	label: "",
	table: null,
	activeKey: null,
	stock: {},

	syncStock: (products) =>
		set({
			stock: Object.fromEntries(
				products.filter((p) => p.trackStock && p.stock !== null).map((p) => [p.id, p.stock as number])
			),
		}),

	add: (product, modifiers = [], note = null) => {
		const remaining = remainingStock(get(), product.id);
		if (remaining !== null && remaining <= 0) return "limit";
		set((state) => {
			const key = lineKey(product.id, modifiers, note);
			const unitPrice = sum(product.price, ...modifiers.map((m) => m.priceDelta));
			const existing = state.lines.find((line) => line.key === key);

			const lines = existing
				? state.lines.map((line) =>
						line.key === key ? { ...line, quantity: line.quantity + 1 } : line
					)
				: [
						...state.lines,
						{
							key,
							productId: product.id,
							name: product.name,
							art: product.art,
							unitPrice,
							quantity: 1,
							modifiers,
							note,
						},
					];

			return { lines, activeKey: key };
		});
		return "added";
	},

	increment: (key) => {
		const line = get().lines.find((l) => l.key === key);
		if (!line) return "limit";
		const remaining = remainingStock(get(), line.productId);
		if (remaining !== null && remaining <= 0) return "limit";
		set((state) => ({
			lines: state.lines.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l)),
			activeKey: key,
		}));
		return "added";
	},

	decrement: (key) =>
		set((state) => {
			const lines = state.lines
				.map((line) => (line.key === key ? { ...line, quantity: line.quantity - 1 } : line))
				.filter((line) => line.quantity > 0);
			return {
				lines,
				activeKey: lines.some((line) => line.key === key)
					? key
					: (lines.at(-1)?.key ?? null),
			};
		}),

	remove: (key) =>
		set((state) => {
			const lines = state.lines.filter((line) => line.key !== key);
			return { lines, activeKey: lines.at(-1)?.key ?? null };
		}),

	setActive: (key) => set({ activeKey: key }),

	updateLine: (key, modifiers, note) => {
		const line = get().lines.find((l) => l.key === key);
		if (!line) return key;
		const nextKey = lineKey(line.productId, modifiers, note);
		// The line keeps only its total unit price; take the old options off to find the base.
		const base = line.unitPrice - sum(...line.modifiers.map((m) => m.priceDelta));
		const unitPrice = sum(base, ...modifiers.map((m) => m.priceDelta));
		set((state) => {
			const twin = nextKey !== key ? state.lines.find((l) => l.key === nextKey) : undefined;
			const lines = twin
				? state.lines
						.filter((l) => l.key !== key)
						.map((l) => (l.key === nextKey ? { ...l, quantity: l.quantity + line.quantity } : l))
				: state.lines.map((l) => (l.key === key ? { ...l, key: nextKey, modifiers, note, unitPrice } : l));
			return { lines, activeKey: nextKey };
		});
		return nextKey;
	},

	setNote: (key, note) =>
		set((state) => ({
			lines: state.lines.map((line) => (line.key === key ? { ...line, note } : line)),
		})),

	setDiscount: (discount) => set({ discount }),
	setCustomer: (customer) => set({ customer }),
	setServiceType: (serviceType) => set({ serviceType }),
	setLabel: (label) => set({ label }),
	setTable: (table) => set({ table }),

	clear: () => set({ lines: [], discount: null, customer: null, label: "", activeKey: null }),
}));

export interface CartTotals {
	itemCount: number;
	subtotal: Satang;
	discount: Satang;
	vat: Satang;
	total: Satang;
}

/**
 * Totals are derived, never stored, so they cannot drift from the lines.
 *
 * `pricesIncludeVat` decides whether VAT is shown as a part of the total (Thai retail norm)
 * or added on top of it (the reference design's ฿265 + ฿18.55).
 */
export const computeTotals = (
	lines: CartLine[],
	discount: Discount | null,
	vatBasisPoints: number,
	pricesIncludeVat: boolean
): CartTotals => {
	const subtotal = sum(...lines.map((line) => multiply(line.unitPrice, line.quantity)));
	const applied = resolveDiscount(discount, subtotal);
	const taxable = subtotal - applied;
	const vat = pricesIncludeVat
		? includedTax(taxable, vatBasisPoints)
		: addedTax(taxable, vatBasisPoints);

	return {
		itemCount: lines.reduce((count, line) => count + line.quantity, 0),
		subtotal,
		discount: applied,
		vat,
		total: pricesIncludeVat ? taxable : taxable + vat,
	};
};
