import { api, bootApp, defaults, ownerWithShop } from "./helpers";
import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

// The full tab walk-through makes a few dozen requests; the 5 s default is too tight.
jest.setTimeout(30_000);

interface Tab {
	id: string;
	status: string;
	orderId: string | null;
	kitchenStatus: string | null;
	lines: { name: string; quantity: number; round: number }[];
	total: number;
	requests: { id: string; status: string; total: number }[];
}

describe("tables and QR ordering", () => {
	let app: INestApplication;
	let owner: Awaited<ReturnType<typeof ownerWithShop>>;
	let base: string;
	let table: { id: string; qrToken: string; name: string };
	let pie: { id: string };

	const guest = (token = table.qrToken) => `/api/v1/public/tables/${token}`;
	const tab = async (sessionId: string) =>
		(
			await api(app)
				.get(`${base}/table-sessions/${sessionId}`)
				.set(auth(owner.token))
				.expect(200)
		).body.data as Tab;
	const stockOf = async (productId: string) =>
		(
			await api(app)
				.get(`${base}/products/${productId}`)
				.set(auth(owner.token))
				.expect(200)
		).body.data.stock as number;
	const kitchen = async () =>
		(await api(app).get(`${base}/kitchen`).set(auth(owner.token)).expect(200)).body
			.data.open as { id: string; status: string; lines: { round: number }[] }[];

	beforeAll(async () => {
		app = await bootApp();
		owner = await ownerWithShop(app, "BUSINESS");
		base = `/api/v1/businesses/${owner.businessId}`;
		table = (
			await api(app)
				.post(`${base}/tables`)
				.set(auth(owner.token))
				.send({ name: "โต๊ะ 1", zone: "ในร้าน", seats: 4 })
				.expect(201)
		).body.data;
		pie = (
			await api(app)
				.post(`${base}/products`)
				.set(auth(owner.token))
				.send({
					name: "พายสับปะรด",
					price: 5000,
					cost: 2000,
					trackStock: true,
					stock: 5,
				})
				.expect(201)
		).body.data;
	});

	afterAll(async () => {
		await app.close();
	});

	it("keeps how many a table seats, and lets it be cleared", async () => {
		expect(table).toMatchObject({ seats: 4 });
		const cleared = await api(app)
			.patch(`${base}/tables/${table.id}`)
			.set(auth(owner.token))
			.send({ seats: null })
			.expect(200);
		expect(cleared.body.data.seats).toBeNull();
		await api(app)
			.patch(`${base}/tables/${table.id}`)
			.set(auth(owner.token))
			.send({ seats: 0 })
			.expect(400);
	});

	it("refuses a duplicate table name and an unknown QR", async () => {
		await api(app)
			.post(`${base}/tables`)
			.set(auth(owner.token))
			.send({ name: "โต๊ะ 1" })
			.expect(409);
		await api(app).get(guest("nope")).expect(404);
	});

	const selfOpen = (on: boolean) =>
		api(app)
			.patch(base)
			.set(auth(owner.token))
			.send({ tableSelfOpen: on })
			.expect(200);

	it("shows guests the menu without what the shop pays, and no ordering while closed", async () => {
		// The shop wants staff to open every table first.
		await selfOpen(false);
		const menu = (await api(app).get(guest()).expect(200)).body.data;
		expect(menu.tableName).toBe("โต๊ะ 1");
		expect(menu.open).toBe(false);
		const shown = menu.products.find((p: { id: string }) => p.id === pie.id);
		expect(shown).toMatchObject({ price: 5000, soldOut: false });
		expect(shown).not.toHaveProperty("cost");
		expect(shown).not.toHaveProperty("stock");
		expect(JSON.stringify(menu)).not.toContain("costDelta");

		await api(app)
			.post(`${guest()}/requests`)
			.send({
				clientRequestId: randomUUID(),
				items: [{ productId: pie.id, quantity: 1 }],
			})
			.expect(409);
		await selfOpen(true);
	});

	it("lets a guest open a free table, and frees it again when the only round is turned down", async () => {
		const second = (
			await api(app)
				.post(`${base}/tables`)
				.set(auth(owner.token))
				.send({ name: "โต๊ะ 2" })
				.expect(201)
		).body.data as { id: string; qrToken: string };
		expect(
			(await api(app).get(guest(second.qrToken)).expect(200)).body.data.open
		).toBe(true);

		await api(app)
			.post(`${guest(second.qrToken)}/requests`)
			.send({
				clientRequestId: randomUUID(),
				items: [{ productId: pie.id, quantity: 1 }],
			})
			.expect(201);
		const board = (
			await api(app).get(`${base}/tables/board`).set(auth(owner.token)).expect(200)
		).body.data as {
			id: string;
			tab: { id: string; pendingRequests: number } | null;
		}[];
		const tab = board.find((t) => t.id === second.id)?.tab;
		expect(tab).toMatchObject({ pendingRequests: 1 });

		// The bell has it too, pointing at the tab.
		const bell = (
			await api(app).get(`${base}/notifications`).set(auth(owner.token)).expect(200)
		).body.data.items as {
			kind: string;
			entityId: string;
			data: Record<string, unknown>;
		}[];
		expect(bell.find((n) => n.kind === "TABLE_REQUEST")).toMatchObject({
			entityId: tab?.id,
			data: { table: "โต๊ะ 2", items: 1 },
		});

		const request = (await (async () => {
			const t = (
				await api(app)
					.get(`${base}/table-sessions/${tab?.id}`)
					.set(auth(owner.token))
					.expect(200)
			).body.data as Tab;
			return t.requests[0];
		})()) as { id: string };
		await api(app)
			.post(`${base}/table-requests/${request.id}/reject`)
			.set(auth(owner.token))
			.expect(200);
		const after = (
			await api(app).get(`${base}/tables/board`).set(auth(owner.token)).expect(200)
		).body.data as { id: string; tab: unknown }[];
		expect(after.find((t) => t.id === second.id)?.tab).toBeNull();
		await api(app)
			.delete(`${base}/tables/${second.id}`)
			.set(auth(owner.token))
			.expect(200);
	});

	it("runs a tab: guest rounds wait, accepted rounds cook and take stock, check-out pays once", async () => {
		const opened = (
			await api(app)
				.post(`${base}/tables/${table.id}/open`)
				.set(auth(owner.token))
				.send({ guests: 2 })
				.expect(201)
		).body.data as Tab;
		expect(opened).toMatchObject({ status: "OPEN", orderId: null, total: 0 });
		await api(app)
			.post(`${base}/tables/${table.id}/open`)
			.set(auth(owner.token))
			.send({})
			.expect(409);

		// Round 1 from the QR: nothing happens until staff accept it.
		const clientRequestId = randomUUID();
		const send = () =>
			api(app)
				.post(`${guest()}/requests`)
				.send({ clientRequestId, items: [{ productId: pie.id, quantity: 2 }] })
				.expect(201);
		await send();
		await send(); // a double tap
		let current = await tab(opened.id);
		expect(current.requests).toHaveLength(1);
		expect(current.requests[0]).toMatchObject({ status: "PENDING", total: 10_000 });
		expect(await stockOf(pie.id)).toBe(5);

		current = (
			await api(app)
				.post(`${base}/table-requests/${current.requests[0].id}/accept`)
				.set(auth(owner.token))
				.expect(200)
		).body.data;
		expect(current.orderId).not.toBeNull();
		expect(current.kitchenStatus).toBe("NEW");
		expect(current.lines).toEqual([
			expect.objectContaining({ name: "พายสับปะรด", quantity: 2, round: 1 }),
		]);
		expect(await stockOf(pie.id)).toBe(3);
		await api(app)
			.post(`${base}/table-requests/${current.requests[0].id}/accept`)
			.set(auth(owner.token))
			.expect(409);

		// The kitchen serves round 1, then round 2 from the till puts the ticket back.
		let ticket = (await kitchen()).find((t) => t.id === current.orderId);
		expect(ticket).toBeDefined();
		await api(app)
			.patch(`${base}/kitchen/${current.orderId}`)
			.set(auth(owner.token))
			.send({ status: "SERVED" })
			.expect(200);
		expect((await kitchen()).find((t) => t.id === current.orderId)).toBeUndefined();

		const latte = owner.products.find((p) => p.name === "Latte")!;
		current = (
			await api(app)
				.post(`${base}/table-sessions/${opened.id}/items`)
				.set(auth(owner.token))
				.send({
					clientRequestId: randomUUID(),
					items: [
						{ productId: latte.id, quantity: 1, modifierOptionIds: defaults(latte) },
					],
				})
				.expect(200)
		).body.data;
		expect(current.kitchenStatus).toBe("NEW");
		expect(current.lines.map((l) => l.round)).toEqual([1, 2]);
		ticket = (await kitchen()).find((t) => t.id === current.orderId);
		expect(ticket?.lines.map((l) => l.round)).toEqual([1, 2]);

		// The guest sees the bill; a round left pending at check-out is turned down.
		await api(app)
			.post(`${guest()}/requests`)
			.send({
				clientRequestId: randomUUID(),
				items: [{ productId: pie.id, quantity: 1 }],
			})
			.expect(201);
		const guestTab = (await api(app).get(`${guest()}/tab`).expect(200)).body.data;
		expect(guestTab.open).toBe(true);
		expect(guestTab.total).toBe(current.total);
		expect(guestTab.lines).toHaveLength(2);
		expect(JSON.stringify(guestTab)).not.toContain("Owner");

		// Unpaid tabs stay out of the sales figures until they are paid.
		const order = (
			await api(app)
				.get(`${base}/orders/${current.orderId}`)
				.set(auth(owner.token))
				.expect(200)
		).body.data;
		expect(order.status).toBe("PENDING_PAYMENT");
		await api(app)
			.post(`${base}/orders/${current.orderId}/cancel`)
			.set(auth(owner.token))
			.send({})
			.expect(409);

		const paid = (
			await api(app)
				.post(`${base}/table-sessions/${opened.id}/close`)
				.set(auth(owner.token))
				.send({ discount: 1000, payment: { method: "CASH", received: 100_000 } })
				.expect(200)
		).body.data;
		expect(paid).toMatchObject({
			status: "PAID",
			label: "โต๊ะ 1",
			serviceType: "DINE_IN",
			discount: 1000,
			total: current.total - 1000,
			change: 100_000 - (current.total - 1000),
		});
		const closed = await tab(opened.id);
		expect(closed.status).toBe("CLOSED");
		expect(closed.requests.map((r) => r.status)).toEqual([
			"ACCEPTED",
			"ACCEPTED",
			"REJECTED",
		]);
		expect((await api(app).get(`${guest()}/tab`).expect(200)).body.data.open).toBe(
			false
		);
		await api(app)
			.post(`${base}/table-sessions/${opened.id}/close`)
			.set(auth(owner.token))
			.send({ payment: { method: "CARD" } })
			.expect(409);
	});

	it("voids a tab and puts back what it took", async () => {
		const opened = (
			await api(app)
				.post(`${base}/tables/${table.id}/open`)
				.set(auth(owner.token))
				.send({})
				.expect(201)
		).body.data as Tab;
		const before = await stockOf(pie.id);
		await api(app)
			.post(`${base}/table-sessions/${opened.id}/items`)
			.set(auth(owner.token))
			.send({
				clientRequestId: randomUUID(),
				items: [{ productId: pie.id, quantity: 1 }],
			})
			.expect(200);
		expect(await stockOf(pie.id)).toBe(before - 1);

		await api(app)
			.post(`${base}/table-sessions/${opened.id}/cancel`)
			.set(auth(owner.token))
			.send({ reason: "ลูกค้ายกเลิก" })
			.expect(200);
		expect(await stockOf(pie.id)).toBe(before);
		const voided = await tab(opened.id);
		expect(voided.status).toBe("CANCELLED");
		const order = (
			await api(app)
				.get(`${base}/orders/${voided.orderId}`)
				.set(auth(owner.token))
				.expect(200)
		).body.data;
		expect(order.status).toBe("CANCELLED");
	});

	it("retires the old QR when it is rotated", async () => {
		const old = table.qrToken;
		const rotated = (
			await api(app)
				.post(`${base}/tables/${table.id}/rotate-qr`)
				.set(auth(owner.token))
				.expect(200)
		).body.data;
		expect(rotated.qrToken).not.toBe(old);
		await api(app).get(guest(old)).expect(404);
		await api(app).get(guest(rotated.qrToken)).expect(200);
	});

	it("keeps one shop's tables away from another", async () => {
		const other = await ownerWithShop(app, "BUSINESS");
		await api(app)
			.post(`/api/v1/businesses/${other.businessId}/tables/${table.id}/open`)
			.set(auth(other.token))
			.send({})
			.expect(404);
	});
});
