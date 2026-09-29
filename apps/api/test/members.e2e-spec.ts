import { api, bootApp, ownerWithShop } from "./helpers";
import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

const register = async (app: INestApplication, email: string, name: string) => {
	const res = await api(app)
		.post("/api/v1/auth/register")
		.send({ email, password: "Passw0rd!x", name })
		.expect(201);
	return res.body.data.accessToken as string;
};

const tokenOf = (inviteUrl: string) => inviteUrl.split("/invite/")[1];

describe("invitations", () => {
	let app: INestApplication;

	beforeAll(async () => {
		app = await bootApp();
	});
	afterAll(async () => {
		await app.close();
	});

	it("registering with the invited email grants nothing without the link", async () => {
		const owner = await ownerWithShop(app);
		const email = `squatter-${randomUUID()}@e2e.test`;
		await api(app)
			.post(`/api/v1/businesses/${owner.businessId}/members`)
			.set(auth(owner.token))
			.send({ email, name: "Manager", role: "MANAGER" })
			.expect(201);

		// Someone else registers that address first — nothing verifies it.
		const squatter = await register(app, email, "Squatter");
		const shops = await api(app)
			.get("/api/v1/businesses")
			.set(auth(squatter))
			.expect(200);
		expect(shops.body.data).toEqual([]);
		await api(app)
			.get(`/api/v1/businesses/${owner.businessId}/orders`)
			.set(auth(squatter))
			.expect(404);
	});

	it("the link works once, and a regenerated link revokes the old one", async () => {
		const owner = await ownerWithShop(app);
		const invited = await api(app)
			.post(`/api/v1/businesses/${owner.businessId}/members`)
			.set(auth(owner.token))
			.send({ email: `c-${randomUUID()}@e2e.test`, name: "Mind", role: "CASHIER" })
			.expect(201);
		const oldToken = tokenOf(invited.body.data.inviteUrl);

		const renewed = await api(app)
			.post(
				`/api/v1/businesses/${owner.businessId}/members/${invited.body.data.member.id}/invite-link`
			)
			.set(auth(owner.token))
			.expect(200);
		const token = tokenOf(renewed.body.data.inviteUrl);

		await api(app).get(`/api/v1/invites/${oldToken}`).expect(404);
		const preview = await api(app).get(`/api/v1/invites/${token}`).expect(200);
		expect(preview.body.data).toMatchObject({
			businessName: "E2E Cafe",
			role: "CASHIER",
		});

		const first = await register(app, `anyone-${randomUUID()}@e2e.test`, "Mind");
		const second = await register(app, `other-${randomUUID()}@e2e.test`, "Other");
		const results = await Promise.all([
			api(app).post("/api/v1/invites/accept").set(auth(first)).send({ token }),
			api(app).post("/api/v1/invites/accept").set(auth(second)).send({ token }),
		]);
		// Exactly one joins. The loser sees 410 if it raced the update, 404 if it arrived after
		// the token was already cleared — either way it is refused.
		const statuses = results.map((r) => r.status).sort();
		expect(statuses[0]).toBe(200);
		expect([404, 410]).toContain(statuses[1]);
	});

	it("an accepted cashier can sell, sees only their own orders, and cannot refund or discount", async () => {
		const owner = await ownerWithShop(app);
		const base = `/api/v1/businesses/${owner.businessId}`;
		const croissant = owner.products.find((p) => p.name === "Croissant")!;
		const sale = (token: string, extra: object = {}) =>
			api(app)
				.post(`${base}/orders`)
				.set(auth(token))
				.send({
					clientOrderId: randomUUID(),
					items: [{ productId: croissant.id, quantity: 1 }],
					payment: { method: "CARD" },
					...extra,
				});

		const ownerSale = await sale(owner.token).expect(200);
		await sale(owner.token, { discount: 1000 }).expect(200);

		const invite = await api(app)
			.post(`${base}/members`)
			.set(auth(owner.token))
			.send({ email: `c-${randomUUID()}@e2e.test`, name: "Mind", role: "CASHIER" })
			.expect(201);
		const cashier = await register(app, `mind-${randomUUID()}@e2e.test`, "Mind");
		await api(app)
			.post("/api/v1/invites/accept")
			.set(auth(cashier))
			.send({ token: tokenOf(invite.body.data.inviteUrl) })
			.expect(200);

		const mine = await sale(cashier).expect(200);
		expect(mine.body.data.employeeName).toBe("Mind");
		await sale(cashier, { discount: 1000 }).expect(403);

		const list = await api(app).get(`${base}/orders`).set(auth(cashier)).expect(200);
		expect(list.body.data.map((o: { id: string }) => o.id)).toEqual([
			mine.body.data.id,
		]);

		await api(app)
			.get(`${base}/orders/${ownerSale.body.data.id}`)
			.set(auth(cashier))
			.expect(404);
		await api(app)
			.post(`${base}/orders/${mine.body.data.id}/refund`)
			.set(auth(cashier))
			.send({})
			.expect(403);
		await api(app)
			.patch(`${base}/products/${croissant.id}`)
			.set(auth(cashier))
			.send({ price: 1 })
			.expect(403);
		await api(app).get(`${base}/dashboard`).set(auth(cashier)).expect(403);
	});

	it("a stranger gets 404 for another business", async () => {
		const owner = await ownerWithShop(app);
		const stranger = await ownerWithShop(app);
		await api(app)
			.get(`/api/v1/businesses/${owner.businessId}/products`)
			.set(auth(stranger.token))
			.expect(404);
	});
});
