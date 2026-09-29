import { api, bootApp, ownerWithShop } from "./helpers";
import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe("stock adjustments", () => {
	let app: INestApplication;
	let owner: Awaited<ReturnType<typeof ownerWithShop>>;
	let base: string;
	let croissantId: string;

	const adjust = (token: string, productId: string, body: object) =>
		api(app)
			.post(`${base}/products/${productId}/stock-adjustments`)
			.set(auth(token))
			.send(body);

	beforeAll(async () => {
		app = await bootApp();
		owner = await ownerWithShop(app);
		base = `/api/v1/businesses/${owner.businessId}`;
		croissantId = owner.products.find((p) => p.name === "Croissant")!.id;
		await api(app)
			.patch(`${base}/products/${croissantId}`)
			.set(auth(owner.token))
			.send({ trackStock: true, stock: 10 })
			.expect(200);
	});

	afterAll(async () => {
		await app.close();
	});

	it("receives, writes off and counts", async () => {
		const received = await adjust(owner.token, croissantId, {
			type: "IN",
			quantity: 5,
			note: "  รับจากร้านขนม  ",
		}).expect(200);
		expect(received.body.data.stock).toBe(15);

		const out = await adjust(owner.token, croissantId, {
			type: "OUT",
			quantity: 3,
		}).expect(200);
		expect(out.body.data.stock).toBe(12);

		const counted = await adjust(owner.token, croissantId, {
			type: "COUNT",
			quantity: 7,
		}).expect(200);
		expect(counted.body.data.stock).toBe(7);
	});

	it("refuses to go below zero, a zero move, and untracked products", async () => {
		await adjust(owner.token, croissantId, { type: "OUT", quantity: 999 }).expect(
			409
		);
		await adjust(owner.token, croissantId, { type: "IN", quantity: 0 }).expect(400);
		await adjust(owner.token, croissantId, { type: "IN", quantity: -1 }).expect(400);
		await adjust(owner.token, croissantId, { type: "COUNT", quantity: 0 }).expect(
			200
		);

		const latte = owner.products.find((p) => p.name === "Latte")!;
		await adjust(owner.token, latte.id, { type: "IN", quantity: 1 }).expect(400);
	});

	it("keeps a sale that lands during a count consistent", async () => {
		await adjust(owner.token, croissantId, { type: "COUNT", quantity: 5 }).expect(
			200
		);
		const [sale, receive] = await Promise.all([
			api(app)
				.post(`${base}/orders`)
				.set(auth(owner.token))
				.send({
					clientOrderId: randomUUID(),
					items: [{ productId: croissantId, quantity: 2 }],
					payment: { method: "CARD" },
				}),
			adjust(owner.token, croissantId, { type: "IN", quantity: 10 }),
		]);
		expect(sale.status).toBe(200);
		expect(receive.status).toBe(200);
		const after = await api(app)
			.get(`${base}/products/${croissantId}`)
			.set(auth(owner.token));
		expect(after.body.data.stock).toBe(13);
	});

	it("is for members with inventory:write only, and 404s across shops", async () => {
		const other = await ownerWithShop(app);
		await adjust(other.token, croissantId, { type: "IN", quantity: 1 }).expect(404);

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
		await adjust(cashier, croissantId, { type: "IN", quantity: 1 }).expect(403);
		await api(app).get(`${base}/stock-adjustments`).set(auth(cashier)).expect(403);
	});

	it("lists the history newest first, with who, before/after and filters", async () => {
		const history = await api(app)
			.get(`${base}/stock-adjustments?productId=${croissantId}&limit=100`)
			.set(auth(owner.token))
			.expect(200);
		const rows = history.body.data;
		expect(rows.length).toBeGreaterThanOrEqual(6);
		// Newest is the IN +10 from the concurrency test; oldest is the first receipt.
		expect(rows[0]).toMatchObject({
			type: "IN",
			quantity: 10,
			change: 10,
			productName: "Croissant",
		});
		expect(rows.at(-1)).toMatchObject({
			type: "IN",
			quantity: 5,
			before: 10,
			after: 15,
			note: "รับจากร้านขนม",
			actorName: "Owner",
		});
		expect(
			rows.find(
				(r: { type: string; quantity: number }) =>
					r.type === "COUNT" && r.quantity === 7
			)
		).toMatchObject({ before: 12, after: 7, change: -5 });

		const outs = await api(app)
			.get(`${base}/stock-adjustments?type=OUT`)
			.set(auth(owner.token))
			.expect(200);
		expect(outs.body.data.every((r: { type: string }) => r.type === "OUT")).toBe(
			true
		);
		expect(outs.body.meta.total).toBe(1);

		const other = await ownerWithShop(app);
		const theirs = await api(app)
			.get(`/api/v1/businesses/${other.businessId}/stock-adjustments`)
			.set(auth(other.token))
			.expect(200);
		expect(theirs.body.data).toEqual([]);
	});

	it("stores a product's unit, trimmed, and refuses a blank one", async () => {
		const res = await api(app)
			.patch(`${base}/products/${croissantId}`)
			.set(auth(owner.token))
			.send({ unit: "  ถุง  " })
			.expect(200);
		expect(res.body.data.unit).toBe("ถุง");
		await api(app)
			.patch(`${base}/products/${croissantId}`)
			.set(auth(owner.token))
			.send({ unit: "   " })
			.expect(400);
	});
});
