import { computeTotals, useCartStore } from "@/stores/cart-store";
import { PRODUCTS } from "@/lib/mock/catalog";
import { beforeEach, describe, expect, it } from "vitest";

const americano = PRODUCTS.find((p) => p.id === "p-americano")!;

describe("cart", () => {
	beforeEach(() => {
		useCartStore.getState().clear();
		useCartStore.getState().syncStock([]);
	});

	it("stops at the stock on the shelf, counting every line of the product", () => {
		const croissant = { ...americano, id: "p-croissant", modifierGroups: [] };
		useCartStore.getState().syncStock([{ id: "p-croissant", trackStock: true, stock: 2 }]);
		const { add } = useCartStore.getState();
		expect(add(croissant)).toBe("added");
		expect(add(croissant, [{ groupName: "อุ่น", optionName: "อุ่น", priceDelta: 0 }])).toBe("added");
		expect(add(croissant)).toBe("limit");
		const key = useCartStore.getState().lines[0].key;
		expect(useCartStore.getState().increment(key)).toBe("limit");
		expect(useCartStore.getState().lines.reduce((n, l) => n + l.quantity, 0)).toBe(2);
	});

	it("does not limit products that do not track stock", () => {
		for (let i = 0; i < 50; i++) expect(useCartStore.getState().add(americano)).toBe("added");
	});

	it("merges identical taps into one line and keeps different modifiers apart", () => {
		const { add } = useCartStore.getState();
		add(americano);
		add(americano);
		add(americano, [{ groupName: "ความหวาน", optionName: "0%", priceDelta: 0 }]);

		const { lines } = useCartStore.getState();
		expect(lines).toHaveLength(2);
		expect(lines[0].quantity).toBe(2);
	});

	it("prices a line with its modifier deltas", () => {
		useCartStore.getState().add(americano, [
			{ groupName: "ขนาด", optionName: "L", priceDelta: 2000 },
			{ groupName: "เพิ่มเติม", optionName: "Extra Shot", priceDelta: 1500 },
		]);
		expect(useCartStore.getState().lines[0].unitPrice).toBe(9500);
	});

	it("re-picks a line's options in place, repricing from the base price", () => {
		const { add } = useCartStore.getState();
		add(americano, [{ groupName: "ขนาด", optionName: "L", priceDelta: 2000 }]);
		const key = useCartStore.getState().lines[0].key;
		useCartStore.getState().increment(key);

		const next = useCartStore.getState().updateLine(key, [{ groupName: "ขนาด", optionName: "M", priceDelta: 1000 }], "หวานน้อย");
		const [line] = useCartStore.getState().lines;
		expect(useCartStore.getState().lines).toHaveLength(1);
		expect(line.key).toBe(next);
		expect(line.unitPrice).toBe(americano.price + 1000);
		expect(line.quantity).toBe(2);
		expect(line.note).toBe("หวานน้อย");
		expect(useCartStore.getState().activeKey).toBe(next);
	});

	it("merges a re-picked line into an identical one", () => {
		const { add } = useCartStore.getState();
		add(americano);
		add(americano, [{ groupName: "ขนาด", optionName: "L", priceDelta: 2000 }]);
		add(americano, [{ groupName: "ขนาด", optionName: "L", priceDelta: 2000 }]);
		const large = useCartStore.getState().lines[1].key;

		useCartStore.getState().updateLine(large, [], null);
		const { lines } = useCartStore.getState();
		expect(lines).toHaveLength(1);
		expect(lines[0].quantity).toBe(3);
		expect(lines[0].unitPrice).toBe(americano.price);
	});

	it("selects a line without changing it", () => {
		const { add } = useCartStore.getState();
		add(americano);
		add(americano, [{ groupName: "ขนาด", optionName: "L", priceDelta: 2000 }]);
		const first = useCartStore.getState().lines[0].key;
		useCartStore.getState().setActive(first);
		expect(useCartStore.getState().activeKey).toBe(first);
		expect(useCartStore.getState().lines.map((l) => l.quantity)).toEqual([1, 1]);
	});

	it("drops a line when its quantity reaches zero", () => {
		const { add } = useCartStore.getState();
		add(americano);
		const key = useCartStore.getState().lines[0].key;
		useCartStore.getState().decrement(key);
		expect(useCartStore.getState().lines).toHaveLength(0);
	});
});

describe("computeTotals", () => {
	const lines = [
		{ key: "a", productId: "a", name: "A", art: "coffee" as const, unitPrice: 6000, quantity: 1, modifiers: [], note: null },
		{ key: "b", productId: "b", name: "B", art: "latte" as const, unitPrice: 7000, quantity: 2, modifiers: [], note: null },
		{ key: "c", productId: "c", name: "C", art: "croissant" as const, unitPrice: 6500, quantity: 1, modifiers: [], note: null },
	];

	it("adds exclusive VAT on top, as in the reference design", () => {
		expect(computeTotals(lines, null, 700, false)).toEqual({
			itemCount: 4,
			subtotal: 26_500,
			discount: 0,
			vat: 1855,
			total: 28_355,
		});
	});

	it("shows inclusive VAT as a part of the total", () => {
		const totals = computeTotals(lines, null, 700, true);
		expect(totals.total).toBe(26_500);
		expect(totals.vat).toBe(1734);
	});

	it("never discounts below zero", () => {
		expect(computeTotals(lines, { kind: "amount", amount: 99_999 }, 0, true).total).toBe(0);
	});

	it("keeps a percentage a percentage as the cart grows", () => {
		const tenPercent = { kind: "percent" as const, basisPoints: 1000 };
		expect(computeTotals(lines, tenPercent, 0, true).discount).toBe(2650);
		const more = [...lines, { ...lines[0], key: "d", quantity: 5 }];
		expect(computeTotals(more, tenPercent, 0, true).discount).toBe(5650);
	});
});
