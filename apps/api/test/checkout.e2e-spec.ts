import { api, bootApp, ownerWithShop, type ProductRow } from "./helpers";
import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";

describe("checkout", () => {
	let app: INestApplication;
	let owner: Awaited<ReturnType<typeof ownerWithShop>>;
	let croissant: ProductRow;
	let latte: ProductRow;

	const checkout = (token: string, businessId: string, body: object) =>
		api(app)
			.post(`/api/v1/businesses/${businessId}/orders`)
			.set("Authorization", `Bearer ${token}`)
			.send(body);

	beforeAll(async () => {
		app = await bootApp();
		owner = await ownerWithShop(app);
		croissant = owner.products.find((p) => p.name === "Croissant")!;
		latte = owner.products.find((p) => p.name === "Latte")!;
	});

	afterAll(async () => {
		await app.close();
	});

	it("prices the order on the server and ignores anything the client claims", async () => {
		const res = await checkout(owner.token, owner.businessId, {
			clientOrderId: randomUUID(),
			items: [{ productId: croissant.id, quantity: 2, price: 1, unitPrice: 1 }],
			total: 1,
			payment: { method: "CASH", received: 20_000 },
		}).expect(200);

		expect(res.body.data.total).toBe(13_000);
		expect(res.body.data.change).toBe(7000);
		expect(res.body.data.status).toBe("PAID");
	});

	it("adds modifier deltas and rejects an option that is not on the product", async () => {
		const large = latte.modifierGroups
			.find((g) => g.name === "ขนาด")!
			.options.find((o) => o.name === "L")!;
		const sweet = latte.modifierGroups.find((g) => g.name === "ความหวาน")!
			.defaultOptionId!;
		const ok = await checkout(owner.token, owner.businessId, {
			clientOrderId: randomUUID(),
			items: [
				{ productId: latte.id, quantity: 1, modifierOptionIds: [large.id, sweet] },
			],
			payment: { method: "PROMPTPAY" },
		}).expect(200);
		expect(ok.body.data.total).toBe(9000);
		expect(
			ok.body.data.items[0].modifiers.map(
				(m: { optionName: string }) => m.optionName
			)
		).toEqual(expect.arrayContaining(["L", "50%"]));

		await checkout(owner.token, owner.businessId, {
			clientOrderId: randomUUID(),
			items: [
				{ productId: croissant.id, quantity: 1, modifierOptionIds: [large.id] },
			],
			payment: { method: "CARD" },
		}).expect(400);
	});

	it("requires the required modifier groups", async () => {
		await checkout(owner.token, owner.businessId, {
			clientOrderId: randomUUID(),
			items: [{ productId: latte.id, quantity: 1 }],
			payment: { method: "CARD" },
		}).expect(400);
	});

	it("returns the same order for a repeated clientOrderId", async () => {
		const clientOrderId = randomUUID();
		const body = {
			clientOrderId,
			items: [{ productId: croissant.id, quantity: 1 }],
			payment: { method: "CARD" },
		};
		const [a, b] = await Promise.all([
			checkout(owner.token, owner.businessId, body),
			checkout(owner.token, owner.businessId, body),
		]);
		expect(a.status).toBe(200);
		expect(b.status).toBe(200);
		expect(a.body.data.id).toBe(b.body.data.id);
	});

	it("gives concurrent tills distinct, sequential numbers", async () => {
		const results = await Promise.all(
			Array.from({ length: 5 }, () =>
				checkout(owner.token, owner.businessId, {
					clientOrderId: randomUUID(),
					items: [{ productId: croissant.id, quantity: 1 }],
					payment: { method: "CARD" },
				})
			)
		);
		const numbers = results
			.map((r) => Number(r.body.data.number))
			.sort((x, y) => x - y);
		expect(new Set(numbers).size).toBe(5);
		expect(numbers[4] - numbers[0]).toBe(4);
	});

	it("refuses cash below the total and refuses to oversell tracked stock", async () => {
		await checkout(owner.token, owner.businessId, {
			clientOrderId: randomUUID(),
			items: [{ productId: croissant.id, quantity: 1 }],
			payment: { method: "CASH", received: 100 },
		}).expect(400);

		await checkout(owner.token, owner.businessId, {
			clientOrderId: randomUUID(),
			items: [{ productId: croissant.id, quantity: 999 }],
			payment: { method: "CARD" },
		}).expect(409);
	});

	it("sells the last unit to exactly one of two tills checking out at the same moment", async () => {
		// Two cashiers in the same shop, one croissant left on the shelf.
		const base = `/api/v1/businesses/${owner.businessId}`;
		await api(app)
			.patch(`${base}/products/${croissant.id}`)
			.set("Authorization", `Bearer ${owner.token}`)
			.send({ trackStock: true, stock: 1 })
			.expect(200);
		const before = await api(app)
			.get(`${base}/orders?limit=1`)
			.set("Authorization", `Bearer ${owner.token}`);
		const ordersBefore = before.body.meta.total as number;

		const till = () =>
			checkout(owner.token, owner.businessId, {
				clientOrderId: randomUUID(),
				items: [{ productId: croissant.id, quantity: 1 }],
				payment: { method: "CASH", received: 10_000 },
			});
		const results = await Promise.all([till(), till(), till()]);
		const statuses = results.map((r) => r.status).sort();

		expect(statuses).toEqual([200, 409, 409]);
		expect(results.find((r) => r.status === 409)?.body.message).toMatch(
			/out of stock/
		);

		const after = await api(app)
			.get(`${base}/products/${croissant.id}`)
			.set("Authorization", `Bearer ${owner.token}`);
		expect(after.body.data.stock).toBe(0);
		// The losers left nothing behind: one new order, not three.
		const list = await api(app)
			.get(`${base}/orders?limit=1`)
			.set("Authorization", `Bearer ${owner.token}`);
		expect(list.body.meta.total).toBe(ordersBefore + 1);

		// Put the shelf back for the tests that follow.
		await api(app)
			.patch(`${base}/products/${croissant.id}`)
			.set("Authorization", `Bearer ${owner.token}`)
			.send({ stock: 50 })
			.expect(200);
	});

	it("treats another shop's product as not found", async () => {
		const other = await ownerWithShop(app);
		await checkout(owner.token, owner.businessId, {
			clientOrderId: randomUUID(),
			items: [{ productId: other.products[0].id, quantity: 1 }],
			payment: { method: "CARD" },
		}).expect(404);
	});

	it("refunds once, restocks and records who did it", async () => {
		const before = await api(app)
			.get(`/api/v1/businesses/${owner.businessId}/products/${croissant.id}`)
			.set("Authorization", `Bearer ${owner.token}`);
		const sale = await checkout(owner.token, owner.businessId, {
			clientOrderId: randomUUID(),
			items: [{ productId: croissant.id, quantity: 2 }],
			payment: { method: "CARD" },
		}).expect(200);

		const refunded = await api(app)
			.post(
				`/api/v1/businesses/${owner.businessId}/orders/${sale.body.data.id}/refund`
			)
			.set("Authorization", `Bearer ${owner.token}`)
			.send({ reason: "e2e" })
			.expect(200);
		expect(refunded.body.data.status).toBe("REFUNDED");
		expect(refunded.body.data.audit[0]).toMatchObject({
			action: "ORDER_REFUNDED",
			reason: "e2e",
		});

		await api(app)
			.post(
				`/api/v1/businesses/${owner.businessId}/orders/${sale.body.data.id}/refund`
			)
			.set("Authorization", `Bearer ${owner.token}`)
			.send({})
			.expect(409);

		const after = await api(app)
			.get(`/api/v1/businesses/${owner.businessId}/products/${croissant.id}`)
			.set("Authorization", `Bearer ${owner.token}`);
		expect(after.body.data.stock).toBe(before.body.data.stock);
	});

	it("counts only paid orders in the dashboard", async () => {
		const res = await api(app)
			.get(`/api/v1/businesses/${owner.businessId}/dashboard?range=today`)
			.set("Authorization", `Bearer ${owner.token}`)
			.expect(200);
		const { metrics, series, paymentBreakdown } = res.body.data;
		expect(metrics.orders).toBeGreaterThan(0);
		expect(
			series.reduce((s: number, b: { revenue: number }) => s + b.revenue, 0)
		).toBe(metrics.revenue);
		expect(
			paymentBreakdown.reduce((s: number, p: { amount: number }) => s + p.amount, 0)
		).toBe(metrics.revenue);
	});

	it("shows a sale and its refund on the dashboard at once, despite the cache", async () => {
		const dashboard = async () =>
			(
				await api(app)
					.get(`/api/v1/businesses/${owner.businessId}/dashboard?range=today`)
					.set("Authorization", `Bearer ${owner.token}`)
					.expect(200)
			).body.data.metrics as { orders: number; revenue: number };

		const before = await dashboard();
		// Read twice so the second answer comes from the cache.
		expect(await dashboard()).toEqual(before);

		const sale = await checkout(owner.token, owner.businessId, {
			clientOrderId: randomUUID(),
			items: [{ productId: croissant.id, quantity: 1 }],
			payment: { method: "CASH", received: 10_000 },
		}).expect(200);
		const afterSale = await dashboard();
		expect(afterSale.orders).toBe(before.orders + 1);
		expect(afterSale.revenue).toBe(before.revenue + sale.body.data.total);

		await api(app)
			.post(
				`/api/v1/businesses/${owner.businessId}/orders/${sale.body.data.id}/refund`
			)
			.set("Authorization", `Bearer ${owner.token}`)
			.send({})
			.expect(200);
		expect(await dashboard()).toMatchObject({
			orders: before.orders,
			revenue: before.revenue,
		});
	});

	it("returns the comparison period's figures beside each change", async () => {
		const res = await api(app)
			.get(`/api/v1/businesses/${owner.businessId}/dashboard?range=today`)
			.set("Authorization", `Bearer ${owner.token}`)
			.expect(200);
		const { metrics } = res.body.data;
		// Every sale in this suite is from today, so yesterday-by-now is empty: the figures
		// are zero, and a change over zero stays null rather than "+100%".
		expect(metrics).toMatchObject({
			previousRevenue: 0,
			previousOrders: 0,
			previousAverageOrder: 0,
			previousGrossProfit: 0,
			previousEstimatedProfit: 0,
			revenueChange: null,
			ordersChange: null,
		});
	});
});
