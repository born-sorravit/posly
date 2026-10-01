import { api, bootApp, ownerWithShop, setPlan } from "./helpers";
import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

jest.setTimeout(60_000);

describe("tables by plan", () => {
	let app: INestApplication;

	beforeAll(async () => {
		app = await bootApp();
	});

	afterAll(async () => {
		await app.close();
	});

	const tableFor = async (
		owner: Awaited<ReturnType<typeof ownerWithShop>>,
		name: string,
		expect = 201
	) =>
		(
			await api(app)
				.post(`/api/v1/businesses/${owner.businessId}/tables`)
				.set(auth(owner.token))
				.send({ name })
				.expect(expect)
		).body.data as { id: string; qrToken: string };

	it("keeps tables off Free", async () => {
		const owner = await ownerWithShop(app, "FREE");
		await tableFor(owner, "โต๊ะ 1", 403);
	});

	it("gives Starter tables but not QR ordering, up to 10 tables", async () => {
		const owner = await ownerWithShop(app, "STARTER");
		const base = `/api/v1/businesses/${owner.businessId}`;
		const first = await tableFor(owner, "โต๊ะ 1");
		await api(app)
			.post(`${base}/tables/${first.id}/open`)
			.set(auth(owner.token))
			.send({})
			.expect(201);

		// Printed QR cards still load, and say the shop does not take orders from them.
		const menu = (
			await api(app).get(`/api/v1/public/tables/${first.qrToken}`).expect(200)
		).body.data;
		expect(menu).toMatchObject({ qrOrdering: false, open: false });
		const product = owner.products.find((p) => p.modifierGroups.length === 0)!;
		await api(app)
			.post(`/api/v1/public/tables/${first.qrToken}/requests`)
			.send({
				clientRequestId: randomUUID(),
				items: [{ productId: product.id, quantity: 1 }],
			})
			.expect(403);

		for (let n = 2; n <= 10; n++) await tableFor(owner, `โต๊ะ ${n}`);
		await tableFor(owner, "โต๊ะ 11", 403);
	});

	it("lets a shop that downgraded settle the tab it has open", async () => {
		const owner = await ownerWithShop(app, "BUSINESS");
		const base = `/api/v1/businesses/${owner.businessId}`;
		const table = await tableFor(owner, "โต๊ะ 1");
		const tab = (
			await api(app)
				.post(`${base}/tables/${table.id}/open`)
				.set(auth(owner.token))
				.send({})
				.expect(201)
		).body.data as { id: string };
		const product = owner.products.find((p) => p.modifierGroups.length === 0)!;
		await api(app)
			.post(`${base}/table-sessions/${tab.id}/items`)
			.set(auth(owner.token))
			.send({
				clientRequestId: randomUUID(),
				items: [{ productId: product.id, quantity: 1 }],
			})
			.expect(200);

		await setPlan(app, owner.businessId, "FREE");
		// No new work…
		await api(app)
			.post(`${base}/table-sessions/${tab.id}/items`)
			.set(auth(owner.token))
			.send({
				clientRequestId: randomUUID(),
				items: [{ productId: product.id, quantity: 1 }],
			})
			.expect(403);
		// …but the open bill can still be seen and paid.
		await api(app).get(`${base}/tables/board`).set(auth(owner.token)).expect(200);
		const paid = await api(app)
			.post(`${base}/table-sessions/${tab.id}/close`)
			.set(auth(owner.token))
			.send({ payment: { method: "CARD" } })
			.expect(200);
		expect(paid.body.data.status).toBe("PAID");
	});
});
