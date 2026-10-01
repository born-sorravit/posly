import { api, bootApp, defaults, ownerWithShop } from "./helpers";
import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

jest.setTimeout(60_000);

interface Tab {
	id: string;
	tableName: string;
	status: string;
	orderId: string | null;
	guests: number | null;
	lines: { id: string; name: string; quantity: number; round: number }[];
	total: number;
}

describe("moving, merging and splitting tabs", () => {
	let app: INestApplication;
	let owner: Awaited<ReturnType<typeof ownerWithShop>>;
	let base: string;
	let pie: { id: string };
	const tables: Record<string, { id: string; qrToken: string }> = {};

	const post = (path: string, body: object = {}) =>
		api(app).post(`${base}${path}`).set(auth(owner.token)).send(body);
	const tab = async (id: string) =>
		(
			await api(app)
				.get(`${base}/table-sessions/${id}`)
				.set(auth(owner.token))
				.expect(200)
		).body.data as Tab;
	const board = async () =>
		(await api(app).get(`${base}/tables/board`).set(auth(owner.token)).expect(200))
			.body.data as {
			id: string;
			tab: { id: string } | null;
			call: { kind: string } | null;
		}[];
	const stock = async () =>
		(
			await api(app)
				.get(`${base}/products/${pie.id}`)
				.set(auth(owner.token))
				.expect(200)
		).body.data.stock as number;
	const open = async (name: string, guests?: number) =>
		(
			await post(`/tables/${tables[name].id}/open`, guests ? { guests } : {}).expect(
				201
			)
		).body.data as Tab;
	const round = (sessionId: string, items: object[]) =>
		post(`/table-sessions/${sessionId}/items`, {
			clientRequestId: randomUUID(),
			items,
		}).expect(200);

	beforeAll(async () => {
		app = await bootApp();
		owner = await ownerWithShop(app, "BUSINESS");
		base = `/api/v1/businesses/${owner.businessId}`;
		for (const name of ["A", "B", "C"])
			tables[name] = (
				await post("/tables", { name: `โต๊ะ ${name}` }).expect(201)
			).body.data;
		pie = (
			await post("/products", {
				name: "พายไก่",
				price: 4000,
				cost: 1500,
				trackStock: true,
				stock: 10,
			}).expect(201)
		).body.data;
	});

	afterAll(async () => {
		await app.close();
	});

	let first: Tab;
	let second: Tab;

	it("moves a tab, with its call, to a free table only", async () => {
		first = await open("A", 2);
		await round(first.id, [{ productId: pie.id, quantity: 1 }]);
		await api(app)
			.post(`/api/v1/public/tables/${tables.A.qrToken}/call`)
			.send({ kind: "WAITER" })
			.expect(200);

		const moved = (
			await post(`/table-sessions/${first.id}/move`, {
				tableId: tables.B.id,
			}).expect(200)
		).body.data as Tab;
		expect(moved.tableName).toBe("โต๊ะ B");
		const order = (
			await api(app)
				.get(`${base}/orders/${moved.orderId}`)
				.set(auth(owner.token))
				.expect(200)
		).body.data;
		expect(order.label).toBe("โต๊ะ B");
		const floor = await board();
		expect(floor.find((t) => t.id === tables.A.id)).toMatchObject({
			tab: null,
			call: null,
		});
		expect(floor.find((t) => t.id === tables.B.id)).toMatchObject({
			tab: { id: first.id },
			call: { kind: "WAITER" },
		});

		second = await open("C", 3);
		await post(`/table-sessions/${first.id}/move`, { tableId: tables.C.id }).expect(
			409
		);
	});

	it("merges another tab in without touching stock", async () => {
		const latte = owner.products.find((p) => p.name === "Latte")!;
		await round(second.id, [
			{ productId: pie.id, quantity: 2 },
			{ productId: latte.id, quantity: 1, modifierOptionIds: defaults(latte) },
		]);
		const before = await stock();
		expect(before).toBe(7);
		const otherTotal = (await tab(second.id)).total;
		const ownTotal = (await tab(first.id)).total;

		const merged = (
			await post(`/table-sessions/${first.id}/merge`, {
				sessionId: second.id,
			}).expect(200)
		).body.data as Tab;
		expect(merged.lines.map((l) => [l.name, l.quantity, l.round])).toEqual([
			["พายไก่", 1, 1],
			["พายไก่", 2, 2],
			["Latte", 1, 2],
		]);
		expect(merged.total).toBe(ownTotal + otherTotal);
		expect(merged.guests).toBe(5);
		expect(await stock()).toBe(before);
		expect((await tab(second.id)).status).toBe("CLOSED");
		const emptied = (
			await api(app)
				.get(`${base}/orders/${(await tab(second.id)).orderId ?? ""}`)
				.set(auth(owner.token))
		).body.data;
		if (emptied) expect(emptied).toMatchObject({ status: "CANCELLED", total: 0 });
	});

	it("splits part of the tab off as its own paid order, once", async () => {
		const merged = await tab(first.id);
		const twoPies = merged.lines.find((l) => l.quantity === 2)!;
		const clientOrderId = randomUUID();
		const split = () =>
			post(`/table-sessions/${first.id}/split`, {
				clientOrderId,
				items: [{ itemId: twoPies.id, quantity: 1 }],
				payment: { method: "CASH", received: 10_000 },
			}).expect(200);
		const paid = (await split()).body.data;
		expect(paid).toMatchObject({
			status: "PAID",
			label: "โต๊ะ B",
			total: 4000,
			change: 6000,
		});
		expect(paid.items).toEqual([
			expect.objectContaining({ name: "พายไก่", quantity: 1 }),
		]);
		expect((await split()).body.data.id).toBe(paid.id); // a retry charges nothing more

		const after = await tab(first.id);
		expect(after.lines.find((l) => l.id === twoPies.id)?.quantity).toBe(1);
		expect(after.total).toBe(merged.total - 4000);
		expect(await stock()).toBe(7);

		// Paying everything is a check-out, not a split.
		await post(`/table-sessions/${first.id}/split`, {
			clientOrderId: randomUUID(),
			items: after.lines.map((l) => ({ itemId: l.id, quantity: l.quantity })),
			payment: { method: "CARD" },
		}).expect(409);

		// The split order and the rest of the tab each give back exactly what they hold.
		await post(`/orders/${paid.id}/refund`, {}).expect(200);
		expect(await stock()).toBe(8);
		await post(`/table-sessions/${first.id}/cancel`, {}).expect(200);
		expect(await stock()).toBe(10);
	});
});
