import { recipeCost, unitCost } from "@/modules/inventory/recipe-cost";

const beans = { purchasePrice: 50_000, purchaseQty: 1000 }; // ฿500 per 1,000 g
const milk = { purchasePrice: 9500, purchaseQty: 2000 }; // ฿95 per 2,000 ml
const cup = { purchasePrice: 25_000, purchaseQty: 100 }; // ฿250 per 100 cups

describe("recipeCost", () => {
	it("prices each ingredient as bought and adds them up", () => {
		// 18 g × 50 + 150 ml × 4.75 + 1 × 250 = 900 + 712.5 + 250
		expect(
			recipeCost([
				{ quantity: 18, ingredient: beans },
				{ quantity: 150, ingredient: milk },
				{ quantity: 1, ingredient: cup },
			])
		).toBe(1863);
	});

	it("rounds once, at the end", () => {
		const salt = { purchasePrice: 1000, purchaseQty: 3000 }; // 1/3 satang per g
		expect(
			recipeCost([
				{ quantity: 1, ingredient: salt },
				{ quantity: 1, ingredient: salt },
			])
		).toBe(1);
	});

	it("is zero for an empty recipe or an ingredient with no amount bought", () => {
		expect(recipeCost([])).toBe(0);
		expect(unitCost({ purchasePrice: 500, purchaseQty: 0 })).toBe(0);
	});
});
