import { api, bootApp, ownerWithShop } from "./helpers";
import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
/** Today in Bangkok, the demo shops' timezone. */
const today = () =>
	new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());

describe("expenses and customers", () => {
	let app: INestApplication;
	let owner: Awaited<ReturnType<typeof ownerWithShop>>;
	let base: string;

	beforeAll(async () => {
		app = await bootApp();
		owner = await ownerWithShop(app, "PRO");
		base = `/api/v1/businesses/${owner.businessId}`;
	});
	afterAll(async () => {
		await app.close();
	});

	it("keeps both behind the plan", async () => {
		const free = await ownerWithShop(app, "FREE");
		const b = `/api/v1/businesses/${free.businessId}`;
		await api(app).get(`${b}/expenses`).set(auth(free.token)).expect(403);
		await api(app).get(`${b}/customers`).set(auth(free.token)).expect(403);
	});

	it("records expenses, sums them by category, and takes them off the estimated profit", async () => {
		const before = await api(app)
			.get(`${base}/dashboard?range=today`)
			.set(auth(owner.token))
			.expect(200);

		const rent = await api(app)
			.post(`${base}/expenses`)
			.set(auth(owner.token))
			.send({
				category: "RENT",
				amount: 300_000,
				spentOn: today(),
				note: "  ค่าเช่าเดือนนี้ ",
			})
			.expect(201);
		expect(rent.body.data).toMatchObject({
			category: "RENT",
			amount: 300_000,
			note: "ค่าเช่าเดือนนี้",
			recordedBy: "Owner",
		});
		await api(app)
			.post(`${base}/expenses`)
			.set(auth(owner.token))
			.send({ category: "INGREDIENTS", amount: 150_000, spentOn: today() })
			.expect(201);
		await api(app)
			.post(`${base}/expenses`)
			.set(auth(owner.token))
			.send({ category: "RENT", amount: 0, spentOn: today() })
			.expect(400);

		const summary = await api(app)
			.get(`${base}/expenses/summary?from=${today()}&to=${today()}`)
			.set(auth(owner.token))
			.expect(200);
		expect(summary.body.data).toEqual({
			total: 450_000,
			byCategory: { RENT: 300_000, INGREDIENTS: 150_000 },
		});

		await api(app)
			.patch(`${base}/expenses/${rent.body.data.id}`)
			.set(auth(owner.token))
			.send({ amount: 250_000 })
			.expect(200);
		const list = await api(app)
			.get(`${base}/expenses?category=RENT`)
			.set(auth(owner.token))
			.expect(200);
		expect(list.body.data.map((e: { amount: number }) => e.amount)).toEqual([
			250_000,
		]);

		const after = await api(app)
			.get(`${base}/dashboard?range=today`)
			.set(auth(owner.token))
			.expect(200);
		expect(after.body.data.metrics.expenses).toBe(400_000);
		expect(after.body.data.metrics.estimatedProfit).toBe(
			before.body.data.metrics.estimatedProfit - 400_000
		);
		// Gross profit ignores expenses: it is what the sales themselves earned.
		expect(after.body.data.metrics.grossProfit).toBe(
			before.body.data.metrics.grossProfit
		);
		expect(
			after.body.data.metrics.grossProfit - after.body.data.metrics.expenses
		).toBe(after.body.data.metrics.estimatedProfit);

		await api(app)
			.delete(`${base}/expenses/${rent.body.data.id}`)
			.set(auth(owner.token))
			.expect(200);
		const gone = await api(app)
			.get(`${base}/expenses/summary`)
			.set(auth(owner.token))
			.expect(200);
		expect(gone.body.data.total).toBe(150_000);
	});

	it("keeps customers per shop, one per phone, with totals from their paid orders", async () => {
		const created = await api(app)
			.post(`${base}/customers`)
			.set(auth(owner.token))
			.send({ name: "คุณเอ", phone: "081-234-5678" })
			.expect(201);
		const customer = created.body.data;
		expect(customer).toMatchObject({
			phone: "0812345678",
			totalOrders: 0,
			totalSpending: 0,
			lastVisitAt: null,
		});
		await api(app)
			.post(`${base}/customers`)
			.set(auth(owner.token))
			.send({ name: "ซ้ำ", phone: "0812345678" })
			.expect(409);

		const found = await api(app)
			.get(`${base}/customers?search=5678`)
			.set(auth(owner.token))
			.expect(200);
		expect(found.body.data.map((c: { id: string }) => c.id)).toEqual([customer.id]);

		const croissant = owner.products.find((p) => p.name === "Croissant")!;
		const sale = await api(app)
			.post(`${base}/orders`)
			.set(auth(owner.token))
			.send({
				clientOrderId: randomUUID(),
				customerId: customer.id,
				items: [{ productId: croissant.id, quantity: 2 }],
				payment: { method: "CARD" },
			})
			.expect(200);
		expect(sale.body.data.customerName).toBe("คุณเอ");

		const withSale = await api(app)
			.get(`${base}/customers/${customer.id}`)
			.set(auth(owner.token))
			.expect(200);
		expect(withSale.body.data).toMatchObject({
			totalOrders: 1,
			totalSpending: sale.body.data.total,
		});
		expect(withSale.body.data.lastVisitAt).not.toBeNull();
		const theirs = await api(app)
			.get(`${base}/orders?customerId=${customer.id}`)
			.set(auth(owner.token))
			.expect(200);
		expect(theirs.body.data.map((o: { id: string }) => o.id)).toEqual([
			sale.body.data.id,
		]);

		await api(app)
			.post(`${base}/orders/${sale.body.data.id}/refund`)
			.set(auth(owner.token))
			.send({})
			.expect(200);
		const refunded = await api(app)
			.get(`${base}/customers/${customer.id}`)
			.set(auth(owner.token))
			.expect(200);
		expect(refunded.body.data).toMatchObject({ totalOrders: 0, totalSpending: 0 });

		// Another shop's customer id is simply not found at this till.
		const other = await ownerWithShop(app, "PRO");
		const stranger = await api(app)
			.post(`/api/v1/businesses/${other.businessId}/customers`)
			.set(auth(other.token))
			.send({ name: "คนอื่น" })
			.expect(201);
		await api(app)
			.post(`${base}/orders`)
			.set(auth(owner.token))
			.send({
				clientOrderId: randomUUID(),
				customerId: stranger.body.data.id,
				items: [{ productId: croissant.id, quantity: 1 }],
				payment: { method: "CARD" },
			})
			.expect(404);
	});
});
