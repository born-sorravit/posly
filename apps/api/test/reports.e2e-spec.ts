import { api, bootApp, ownerWithShop, type ProductRow } from "./helpers";
import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";

/** Today in the shop's timezone, as the API's day boundaries see it. */
const today = () =>
	new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());

describe("reports", () => {
	let app: INestApplication;
	let pro: Awaited<ReturnType<typeof ownerWithShop>>;
	let free: Awaited<ReturnType<typeof ownerWithShop>>;
	let croissant: ProductRow;
	let customerId: string;

	const get = (owner: typeof pro, path: string) =>
		api(app)
			.get(`/api/v1/businesses/${owner.businessId}/${path}`)
			.set("Authorization", `Bearer ${owner.token}`);

	beforeAll(async () => {
		app = await bootApp();
		pro = await ownerWithShop(app, "PRO");
		free = await ownerWithShop(app, "FREE");
		croissant = pro.products.find((p) => p.name === "Croissant")!;

		const customer = await api(app)
			.post(`/api/v1/businesses/${pro.businessId}/customers`)
			.set("Authorization", `Bearer ${pro.token}`)
			.send({ name: "Regular", phone: "0812345678" })
			.expect(201);
		customerId = customer.body.data.id;

		for (const linked of [true, false]) {
			await api(app)
				.post(`/api/v1/businesses/${pro.businessId}/orders`)
				.set("Authorization", `Bearer ${pro.token}`)
				.send({
					clientOrderId: randomUUID(),
					items: [{ productId: croissant.id, quantity: 2 }],
					payment: { method: "CASH", received: 50_000 },
					...(linked ? { customerId } : {}),
				})
				.expect(200);
		}
	});

	afterAll(async () => {
		await app.close();
	});

	it("reports a custom range as whole shop-local days", async () => {
		const day = today();
		const res = await get(pro, `dashboard?from=${day}&to=${day}`).expect(200);
		const data = res.body.data;
		expect(data).toMatchObject({ range: "custom", compare: "previous", days: 1 });
		// Midnight in Bangkok is 17:00 UTC the day before.
		expect(new Date(data.to).getTime() - new Date(data.from).getTime()).toBe(86_400_000);
		expect(new Date(data.from).toISOString()).toMatch(/T17:00:00\.000Z$/);
		expect(data.metrics.orders).toBe(2);
		// A one-day window is charted by the hour.
		expect(data.series).toHaveLength(24);
		// The previous period is the day before, the same length.
		expect(new Date(data.from).getTime() - new Date(data.previousFrom).getTime()).toBe(86_400_000);
	});

	it("compares against the same dates a year earlier", async () => {
		const res = await get(pro, "dashboard?range=7d&compare=year").expect(200);
		const { from, previousFrom, compare } = res.body.data;
		expect(compare).toBe("year");
		const back = new Date(from);
		back.setUTCFullYear(back.getUTCFullYear() - 1);
		expect(new Date(previousFrom).getTime()).toBe(back.getTime());
	});

	it("rejects a range that ends before it starts, or runs over a year", async () => {
		await get(pro, "dashboard?from=2026-09-10&to=2026-09-01").expect(400);
		await get(pro, "dashboard?from=2024-01-01&to=2026-01-01").expect(400);
		await get(pro, "dashboard?from=2026-09-01").expect(400);
		await get(pro, "dashboard?from=01/09/2026&to=2026-09-10").expect(400);
	});

	it("keeps custom ranges, year-on-year and insights to plans with the Advanced report", async () => {
		const day = today();
		await get(free, "dashboard?range=7d").expect(200);
		await get(free, `dashboard?from=${day}&to=${day}`).expect(403);
		await get(free, "dashboard?range=7d&compare=year").expect(403);
		await get(free, "reports/insights?range=7d").expect(403);
	});

	it("breaks sales down by hour, product, category and customer", async () => {
		const res = await get(pro, "reports/insights?range=7d").expect(200);
		const { heatmap, products, categories, customers, days } = res.body.data;

		expect(days).toBe(7);
		expect(heatmap.weeks).toHaveLength(7);
		expect(heatmap.weeks.reduce((s: number, n: number) => s + n, 0)).toBe(7);
		expect(heatmap.cells.reduce((s: number, c: { orders: number }) => s + c.orders, 0)).toBe(2);

		const line = products.find((p: { productId: string }) => p.productId === croissant.id);
		expect(line).toMatchObject({ sold: 4, revenue: 4 * croissant.price });
		expect(line.profit).toBe(line.revenue - line.cost);
		expect(
			categories.reduce((s: number, c: { revenue: number }) => s + c.revenue, 0)
		).toBe(products.reduce((s: number, p: { revenue: number }) => s + p.revenue, 0));

		expect(customers).toMatchObject({
			orders: 2,
			identifiedOrders: 1,
			customers: 1,
			newCustomers: 1,
			returningCustomers: 0,
		});
		expect(customers.top[0]).toMatchObject({ id: customerId, name: "Regular", orders: 1 });
		expect(customers.lapsed).toEqual([]);
	});
});
