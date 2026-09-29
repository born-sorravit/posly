import { EntitlementsService } from "@/modules/subscriptions/entitlements.service";
import { api, bootApp, ownerWithShop } from "./helpers";
import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe("notifications", () => {
	let app: INestApplication;
	let owner: Awaited<ReturnType<typeof ownerWithShop>>;
	let base: string;
	let croissantId: string;

	const sell = (token: string, productId: string, quantity = 1) =>
		api(app)
			.post(`${base}/orders`)
			.set(auth(token))
			.send({
				clientOrderId: randomUUID(),
				items: [{ productId, quantity }],
				payment: { method: "CARD" },
			})
			.expect(200);
	const list = async (token: string) =>
		(await api(app).get(`${base}/notifications`).set(auth(token)).expect(200)).body
			.data as {
			items: {
				kind: string;
				entityId: string | null;
				data: Record<string, unknown>;
				read: boolean;
			}[];
			unread: number;
		};
	const kinds = async (token: string) =>
		(await list(token)).items.map((n) => n.kind);

	beforeAll(async () => {
		app = await bootApp();
		owner = await ownerWithShop(app);
		base = `/api/v1/businesses/${owner.businessId}`;
		croissantId = owner.products.find((p) => p.name === "Croissant")!.id;
		await api(app)
			.patch(`${base}/products/${croissantId}`)
			.set(auth(owner.token))
			.send({ trackStock: true, stock: 3, lowStockAt: 2 })
			.expect(200);
	});

	afterAll(async () => {
		await app.close();
	});

	it("speaks when stock crosses the reorder level or runs out, not on every sale", async () => {
		await sell(owner.token, croissantId); // 3 → 2: low
		await sell(owner.token, croissantId); // 2 → 1: still low, nothing new
		expect(await kinds(owner.token)).toEqual(["LOW_STOCK"]);

		await sell(owner.token, croissantId); // 1 → 0
		const { items } = await list(owner.token);
		expect(items.map((n) => n.kind)).toEqual(["OUT_OF_STOCK", "LOW_STOCK"]);
		expect(items[0]).toMatchObject({
			entityId: croissantId,
			data: { name: "Croissant", stock: 0 },
		});

		// Restocked and written back down past the level: a new crossing.
		const adjust = (body: object) =>
			api(app)
				.post(`${base}/products/${croissantId}/stock-adjustments`)
				.set(auth(owner.token))
				.send(body)
				.expect(200);
		await adjust({ type: "IN", quantity: 5 });
		await adjust({ type: "OUT", quantity: 4 });
		expect((await kinds(owner.token))[0]).toBe("LOW_STOCK");
	});

	it("records refunds, tracks read state per member, and hides what a cashier may not see", async () => {
		// Something untracked, so the sale itself says nothing about stock.
		const plain = await api(app)
			.post(`${base}/products`)
			.set(auth(owner.token))
			.send({ name: "Water", price: 1500 })
			.expect(201);
		const orderId = (await sell(owner.token, plain.body.data.id)).body.data
			.id as string;
		await api(app)
			.post(`${base}/orders/${orderId}/refund`)
			.set(auth(owner.token))
			.send({ reason: "ลูกค้าเปลี่ยนใจ" })
			.expect(200);

		const before = await list(owner.token);
		expect(before.items[0]).toMatchObject({
			kind: "REFUND",
			entityId: orderId,
			data: { actor: "Owner", reason: "ลูกค้าเปลี่ยนใจ" },
			read: false,
		});
		expect(before.unread).toBe(before.items.length);

		await api(app)
			.post(`${base}/notifications/read`)
			.set(auth(owner.token))
			.expect(204);
		const after = await list(owner.token);
		expect(after.unread).toBe(0);
		expect(after.items.every((n) => n.read)).toBe(true);

		// A cashier hears about stock, not about refunds.
		const invite = await api(app)
			.post(`${base}/members`)
			.set(auth(owner.token))
			.send({ email: `c-${randomUUID()}@e2e.test`, name: "Mind", role: "CASHIER" })
			.expect(201);
		const reg = await api(app)
			.post("/api/v1/auth/register")
			.send({
				email: `mind-${randomUUID()}@e2e.test`,
				password: "Passw0rd!x",
				name: "Mind",
			})
			.expect(201);
		const cashier = reg.body.data.accessToken as string;
		await api(app)
			.post("/api/v1/invites/accept")
			.set(auth(cashier))
			.send({ token: invite.body.data.inviteUrl.split("/invite/")[1] })
			.expect(200);
		const seen = await list(cashier);
		expect(seen.items.length).toBeGreaterThan(0);
		expect(
			seen.items.every((n) => n.kind === "LOW_STOCK" || n.kind === "OUT_OF_STOCK")
		).toBe(true);
		// The owner reading did not read it for the cashier.
		expect(seen.unread).toBe(seen.items.length);
	});

	it("writes yesterday's summary once, when first asked", async () => {
		const db = app.get(DataSource);
		// Move one sale to yesterday afternoon, shop time.
		await db.query(
			`UPDATE "order" SET created_at = (date_trunc('day', now() AT TIME ZONE 'Asia/Bangkok') - interval '9 hours') AT TIME ZONE 'Asia/Bangkok'
			 WHERE id = (SELECT id FROM "order" WHERE business_id = $1 AND status = 'PAID' ORDER BY number LIMIT 1)`,
			[owner.businessId]
		);
		const first = await list(owner.token);
		const summary = first.items.find((n) => n.kind === "DAILY_SUMMARY");
		expect(summary).toMatchObject({ read: false, data: { orders: 1 } });
		expect(summary!.data.revenue).toBeGreaterThan(0);

		const again = await list(owner.token);
		expect(again.items.filter((n) => n.kind === "DAILY_SUMMARY")).toHaveLength(1);
	});

	it("warns the owner at 80% of the monthly orders and at the limit", async () => {
		const db = app.get(DataSource);
		const entitlements = app.get(EntitlementsService);
		const free = await ownerWithShop(app, "FREE");
		const freeBase = `/api/v1/businesses/${free.businessId}`;
		const bread = free.products.find((p) => p.name === "Croissant")!.id;
		const [{ order_limit: limit }] = await db.query(
			`SELECT order_limit FROM subscription_plan WHERE code = 'FREE'`
		);
		await db.query(
			`UPDATE subscription_plan SET order_limit = 5 WHERE code = 'FREE'`
		);
		entitlements.invalidatePlans();
		try {
			const sale = () =>
				api(app)
					.post(`${freeBase}/orders`)
					.set(auth(free.token))
					.send({
						clientOrderId: randomUUID(),
						items: [{ productId: bread, quantity: 1 }],
						payment: { method: "CARD" },
					})
					.expect(200);
			const quota = async () =>
				(
					await api(app)
						.get(`${freeBase}/notifications`)
						.set(auth(free.token))
						.expect(200)
				).body.data.items.filter((n: { kind: string }) => n.kind === "ORDER_QUOTA");

			for (let i = 0; i < 3; i++) await sale();
			expect(await quota()).toHaveLength(0);
			await sale(); // 4 of 5
			expect((await quota())[0].data).toEqual({ used: 4, limit: 5, full: false });
			await sale(); // 5 of 5
			const both = await quota();
			expect(both.map((n: { data: { full: boolean } }) => n.data.full)).toEqual([
				true,
				false,
			]);
		} finally {
			await db.query(
				`UPDATE subscription_plan SET order_limit = $1 WHERE code = 'FREE'`,
				[limit]
			);
			entitlements.invalidatePlans();
		}
	});

	it("lets each member switch kinds off for themselves", async () => {
		const prefs = await api(app)
			.get(`${base}/notifications/preferences`)
			.set(auth(owner.token))
			.expect(200);
		expect(prefs.body.data).toContainEqual({ kind: "LOW_STOCK", enabled: true });

		const saved = await api(app)
			.put(`${base}/notifications/preferences`)
			.set(auth(owner.token))
			.send({ muted: ["LOW_STOCK", "OUT_OF_STOCK"] })
			.expect(200);
		expect(saved.body.data).toContainEqual({ kind: "LOW_STOCK", enabled: false });
		const heard = await kinds(owner.token);
		expect(heard).not.toContain("LOW_STOCK");
		expect(heard).not.toContain("OUT_OF_STOCK");
		expect(heard).toContain("REFUND");

		await api(app)
			.put(`${base}/notifications/preferences`)
			.set(auth(owner.token))
			.send({ muted: ["NOT_A_KIND"] })
			.expect(400);
		await api(app)
			.put(`${base}/notifications/preferences`)
			.set(auth(owner.token))
			.send({ muted: [] })
			.expect(200);
		expect(await kinds(owner.token)).toContain("LOW_STOCK");
	});
});
