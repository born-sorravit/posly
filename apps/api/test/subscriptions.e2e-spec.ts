import { api, bootApp, ownerWithShop, setPlan } from "./helpers";
import { EntitlementsService } from "@/modules/subscriptions/entitlements.service";
import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe("subscriptions", () => {
	let app: INestApplication;

	/** Lowers a plan's monthly order limit for one test, restoring it afterwards. */
	const withOrderLimit = async (
		plan: string,
		limit: number,
		run: () => Promise<void>
	) => {
		const db = app.get(DataSource);
		const entitlements = app.get(EntitlementsService);
		const [{ order_limit: before }] = await db.query(
			`SELECT order_limit FROM subscription_plan WHERE code = $1`,
			[plan]
		);
		await db.query(`UPDATE subscription_plan SET order_limit = $2 WHERE code = $1`, [
			plan,
			limit,
		]);
		entitlements.invalidatePlans();
		try {
			await run();
		} finally {
			await db.query(
				`UPDATE subscription_plan SET order_limit = $2 WHERE code = $1`,
				[plan, before]
			);
			entitlements.invalidatePlans();
		}
	};

	beforeAll(async () => {
		app = await bootApp();
	});
	afterAll(async () => {
		await app.close();
	});

	it("lists the public plans without signing in", async () => {
		const res = await api(app).get("/api/v1/plans").expect(200);
		expect(res.body.data.map((p: { code: string }) => p.code)).toEqual([
			"FREE",
			"STARTER",
			"PRO",
			"BUSINESS",
		]);
		expect(res.body.data[0]).toMatchObject({
			monthlyPrice: 0,
			orderLimit: 100,
			memberLimit: 1,
		});
		expect(res.body.data[2].features).toContain("INVENTORY");
		// Promised features that have not shipped say so on the card.
		expect(res.body.data[2].highlights).toContainEqual({
			label: "สต๊อกสินค้า",
			soon: false,
		});
		expect(res.body.data[2].highlights).toContainEqual({
			label: "แจ้งเตือน LINE",
			soon: true,
		});
	});

	it("starts a new shop on Free and reports its limits and usage", async () => {
		const owner = await ownerWithShop(app, "FREE");
		const detail = await api(app)
			.get(`/api/v1/businesses/${owner.businessId}`)
			.set(auth(owner.token))
			.expect(200);
		expect(detail.body.data.subscription).toMatchObject({
			plan: "FREE",
			features: [],
			limits: { orders: 100, members: 1, branches: 1 },
			usage: { ordersThisMonth: 0, members: 0, branches: 1 },
		});
	});

	it("gates inventory by plan, and a lapsed paid plan falls back to Free", async () => {
		const owner = await ownerWithShop(app, "FREE");
		const base = `/api/v1/businesses/${owner.businessId}`;
		const croissant = owner.products.find((p) => p.name === "Croissant")!;
		const adjust = () =>
			api(app)
				.post(`${base}/products/${croissant.id}/stock-adjustments`)
				.set(auth(owner.token))
				.send({ type: "IN", quantity: 1 });

		const refused = await adjust().expect(403);
		expect(refused.body.message).toMatch(/does not include INVENTORY/);
		await api(app)
			.get(`${base}/stock-adjustments`)
			.set(auth(owner.token))
			.expect(403);

		await setPlan(app, owner.businessId, "PRO");
		await adjust().expect(200);

		await setPlan(app, owner.businessId, "PRO", new Date(Date.now() - 60_000));
		await adjust().expect(403);
		const detail = await api(app).get(base).set(auth(owner.token)).expect(200);
		expect(detail.body.data.subscription).toMatchObject({
			plan: "FREE",
			subscribedPlan: "PRO",
		});
	});

	it("holds staff to the plan's seats, counting pending invitations and re-enabling", async () => {
		const owner = await ownerWithShop(app, "FREE");
		const base = `/api/v1/businesses/${owner.businessId}`;
		const invite = () =>
			api(app)
				.post(`${base}/members`)
				.set(auth(owner.token))
				.send({
					email: `s-${randomUUID()}@e2e.test`,
					name: "Staff",
					role: "CASHIER",
				});

		const first = await invite().expect(201);
		const full = await invite().expect(403);
		expect(full.body.message).toMatch(/up to 1 employees/);

		// Freeing the seat (cancel) lets the next one in; a disabled member can't come back over the limit.
		await api(app)
			.delete(`${base}/members/${first.body.data.member.id}`)
			.set(auth(owner.token))
			.expect(200);
		const second = await invite().expect(201);
		await setPlan(app, owner.businessId, "STARTER");
		const reg = await api(app)
			.post("/api/v1/auth/register")
			.send({
				email: `j-${randomUUID()}@e2e.test`,
				password: "Passw0rd!x",
				name: "J",
			})
			.expect(201);
		await api(app)
			.post("/api/v1/invites/accept")
			.set(auth(reg.body.data.accessToken))
			.send({ token: second.body.data.inviteUrl.split("/invite/")[1] })
			.expect(200);
		const member = `${base}/members/${second.body.data.member.id}`;
		await api(app)
			.patch(member)
			.set(auth(owner.token))
			.send({ status: "DISABLED" })
			.expect(200);
		await invite().expect(201);
		await setPlan(app, owner.businessId, "FREE");
		await api(app)
			.patch(member)
			.set(auth(owner.token))
			.send({ status: "ACTIVE" })
			.expect(403);
	});

	it("stops checkout at the monthly quota, still returns retried orders, and admits one of two racing tills", async () => {
		const owner = await ownerWithShop(app, "FREE");
		const base = `/api/v1/businesses/${owner.businessId}`;
		const croissant = owner.products.find((p) => p.name === "Croissant")!;
		const sale = (clientOrderId = randomUUID()) =>
			api(app)
				.post(`${base}/orders`)
				.set(auth(owner.token))
				.send({
					clientOrderId,
					items: [{ productId: croissant.id, quantity: 1 }],
					payment: { method: "CARD" },
				});

		await withOrderLimit("FREE", 2, async () => {
			await sale().expect(200);
			const retried = randomUUID();
			await sale(retried).expect(200);
			const over = await sale().expect(403);
			expect(over.body.message).toMatch(/Monthly order limit of 2/);
			// A retry of an order that already went through is not a new sale.
			await sale(retried).expect(200);

			const detail = await api(app).get(base).set(auth(owner.token)).expect(200);
			expect(detail.body.data.subscription.usage.ordersThisMonth).toBe(2);
		});

		await withOrderLimit("FREE", 3, async () => {
			const statuses = (await Promise.all([sale(), sale()]))
				.map((r) => r.status)
				.sort();
			expect(statuses).toEqual([200, 403]);
		});
	});
});
