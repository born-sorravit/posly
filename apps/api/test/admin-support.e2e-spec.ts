import { api, bootApp, ownerWithShop } from "./helpers";
import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe("admin support tools", () => {
	let app: INestApplication;
	let admin: Awaited<ReturnType<typeof ownerWithShop>>;
	let other: Awaited<ReturnType<typeof ownerWithShop>>;
	let shop: Awaited<ReturnType<typeof ownerWithShop>>;

	beforeAll(async () => {
		app = await bootApp();
		[admin, other, shop] = await Promise.all([
			ownerWithShop(app),
			ownerWithShop(app),
			ownerWithShop(app),
		]);
		await app
			.get(DataSource)
			.query(`UPDATE "user" SET is_platform_admin = true WHERE email = ANY($1)`, [
				[admin.email, other.email],
			]);
	});
	afterAll(async () => {
		await app.close();
	});

	it("finds a shop, its owner and an order from one box", async () => {
		const name = `Search Cafe ${randomUUID().slice(0, 8)}`;
		await api(app)
			.patch(`/api/v1/businesses/${shop.businessId}`)
			.set(auth(shop.token))
			.send({ name })
			.expect(200);
		const sale = await api(app)
			.post(`/api/v1/businesses/${shop.businessId}/orders`)
			.set(auth(shop.token))
			.send({
				clientOrderId: randomUUID(),
				items: [
					{
						productId: shop.products.find((p) => p.name === "Croissant")!.id,
						quantity: 1,
					},
				],
				payment: { method: "CASH", received: 10_000 },
			})
			.expect(200);

		const byName = await api(app)
			.get("/api/v1/admin/search")
			.query({ q: name })
			.set(auth(admin.token))
			.expect(200);
		expect(byName.body.data.businesses[0]).toMatchObject({
			id: shop.businessId,
			ownerEmail: shop.email,
		});

		const byEmail = await api(app)
			.get("/api/v1/admin/search")
			.query({ q: shop.email })
			.set(auth(admin.token))
			.expect(200);
		expect(byEmail.body.data.users.map((u: { email: string }) => u.email)).toContain(
			shop.email
		);

		const byId = await api(app)
			.get("/api/v1/admin/search")
			.query({ q: sale.body.data.id })
			.set(auth(admin.token))
			.expect(200);
		expect(byId.body.data.orders).toEqual([
			expect.objectContaining({
				id: sale.body.data.id,
				businessId: shop.businessId,
			}),
		]);

		const byNumber = await api(app)
			.get("/api/v1/admin/search")
			.query({ q: `#${sale.body.data.number}` })
			.set(auth(admin.token))
			.expect(200);
		expect(byNumber.body.data.orders.map((o: { id: string }) => o.id)).toContain(
			sale.body.data.id
		);

		await api(app)
			.get("/api/v1/admin/search")
			.query({ q: name })
			.set(auth(shop.token))
			.expect(404);
	});

	it("keeps notes on a shop, deletable only by their author", async () => {
		const target = { targetType: "business", targetId: shop.businessId };
		const created = await api(app)
			.post("/api/v1/admin/notes")
			.set(auth(admin.token))
			.send({ ...target, body: "  โทรคุยแล้ว ขอขยายทดลองใช้ 14 วัน  " })
			.expect(201);
		expect(created.body.data).toMatchObject({
			adminEmail: admin.email,
			body: "โทรคุยแล้ว ขอขยายทดลองใช้ 14 วัน",
		});

		const list = await api(app)
			.get("/api/v1/admin/notes")
			.query(target)
			.set(auth(other.token))
			.expect(200);
		expect(list.body.data.map((n: { id: string }) => n.id)).toContain(
			created.body.data.id
		);

		await api(app)
			.delete(`/api/v1/admin/notes/${created.body.data.id}`)
			.set(auth(other.token))
			.expect(403);
		await api(app)
			.delete(`/api/v1/admin/notes/${created.body.data.id}`)
			.set(auth(admin.token))
			.expect(204);
		const after = await api(app)
			.get("/api/v1/admin/notes")
			.query(target)
			.set(auth(admin.token))
			.expect(200);
		expect(after.body.data.map((n: { id: string }) => n.id)).not.toContain(
			created.body.data.id
		);

		await api(app)
			.post("/api/v1/admin/notes")
			.set(auth(admin.token))
			.send({ targetType: "user", targetId: randomUUID(), body: "x" })
			.expect(404);
		await api(app)
			.post("/api/v1/admin/notes")
			.set(auth(admin.token))
			.send({ targetType: "order", targetId: shop.businessId, body: "x" })
			.expect(400);
	});

	it("announces to shops on a plan, into their notifications", async () => {
		const free = await ownerWithShop(app, "FREE");
		const audience = await api(app)
			.get("/api/v1/admin/announcements/audience")
			.query({ plan: "FREE" })
			.set(auth(admin.token))
			.expect(200);
		expect(audience.body.data.shops).toBeGreaterThanOrEqual(1);

		const title = `ปิดปรับปรุง ${randomUUID().slice(0, 6)}`;
		const sent = await api(app)
			.post("/api/v1/admin/announcements")
			.set(auth(admin.token))
			.send({ plan: "FREE", title, body: "ระบบจะปิดปรับปรุงคืนวันเสาร์ 02:00–03:00" })
			.expect(200);
		expect(sent.body.data.sent).toBe(audience.body.data.shops);

		const inbox = await api(app)
			.get(`/api/v1/businesses/${free.businessId}/notifications`)
			.set(auth(free.token))
			.expect(200);
		expect(inbox.body.data.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "ANNOUNCEMENT",
					data: expect.objectContaining({ title }),
				}),
			])
		);
		// A PRO shop was not on the list.
		const pro = await api(app)
			.get(`/api/v1/businesses/${shop.businessId}/notifications`)
			.set(auth(shop.token))
			.expect(200);
		expect(
			pro.body.data.items.some(
				(n: { data: { title?: string } }) => n.data.title === title
			)
		).toBe(false);

		const history = await api(app)
			.get("/api/v1/admin/announcements")
			.set(auth(admin.token))
			.expect(200);
		expect(history.body.data[0]).toMatchObject({
			action: "ANNOUNCEMENT_SENT",
			payload: expect.objectContaining({ title }),
		});
	});

	it("charts growth: twelve months, a cohort for this month, today's snapshot", async () => {
		const res = await api(app)
			.get("/api/v1/admin/growth")
			.set(auth(admin.token))
			.expect(200);
		const { months, cohorts, daily, now } = res.body.data;
		expect(months).toHaveLength(12);
		expect(months.at(-1).newBusinesses).toBeGreaterThanOrEqual(3);
		const current = cohorts.at(-1);
		expect(current.size).toBeGreaterThanOrEqual(3);
		expect(current.active[0]).toBeGreaterThanOrEqual(1);
		expect(daily.length).toBeGreaterThanOrEqual(1);
		expect(typeof now.mrr).toBe("number");
	});
});
