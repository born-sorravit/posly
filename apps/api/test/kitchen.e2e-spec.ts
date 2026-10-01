import { api, bootApp, defaults, ownerWithShop } from "./helpers";
import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe("kitchen display", () => {
	let app: INestApplication;
	let owner: Awaited<ReturnType<typeof ownerWithShop>>;
	let base: string;

	const board = async (token = owner.token) =>
		(await api(app).get(`${base}/kitchen`).set(auth(token)).expect(200)).body
			.data as {
			open: {
				id: string;
				number: string;
				status: string;
				lines: {
					id: string;
					name: string;
					modifiers: string[];
					preparedAt: string | null;
				}[];
			}[];
			recent: { id: string }[];
		};
	const sell = async (
		items: {
			productId: string;
			quantity: number;
			modifierOptionIds?: string[];
			note?: string;
		}[]
	) =>
		(
			await api(app)
				.post(`${base}/orders`)
				.set(auth(owner.token))
				.send({ clientOrderId: randomUUID(), items, payment: { method: "CARD" } })
				.expect(200)
		).body.data.id as string;

	beforeAll(async () => {
		app = await bootApp();
		owner = await ownerWithShop(app, "BUSINESS");
		base = `/api/v1/businesses/${owner.businessId}`;
	});

	afterAll(async () => {
		await app.close();
	});

	it("puts cooked lines on the board and leaves the rest off it", async () => {
		const categories = (
			await api(app).get(`${base}/categories`).set(auth(owner.token)).expect(200)
		).body.data as {
			id: string;
			name: string;
			sendToKitchen: boolean;
		}[];
		expect(categories.every((c) => c.sendToKitchen)).toBe(true);

		// A category of bottled drinks that never needs the kitchen.
		const bottles = await api(app)
			.post(`${base}/categories`)
			.set(auth(owner.token))
			.send({ name: "เครื่องดื่มขวด", sendToKitchen: false })
			.expect(201);
		expect(bottles.body.data.sendToKitchen).toBe(false);
		const water = await api(app)
			.post(`${base}/products`)
			.set(auth(owner.token))
			.send({ name: "น้ำเปล่า", price: 1000, categoryId: bottles.body.data.id })
			.expect(201);

		const latte = owner.products.find((p) => p.name === "Latte")!;
		const mixed = await sell([
			{
				productId: latte.id,
				quantity: 2,
				modifierOptionIds: defaults(latte),
				note: "หวานน้อย",
			},
			{ productId: water.body.data.id, quantity: 1 },
		]);
		const waterOnly = await sell([{ productId: water.body.data.id, quantity: 1 }]);

		const { open } = await board();
		const ticket = open.find((t) => t.id === mixed)!;
		expect(ticket.status).toBe("NEW");
		expect(ticket.lines.map((l) => l.name)).toEqual(["Latte"]);
		expect(ticket.lines[0].modifiers.length).toBeGreaterThan(0);
		expect(open.find((t) => t.id === waterOnly)).toBeUndefined();

		await api(app)
			.patch(`${base}/kitchen/${waterOnly}`)
			.set(auth(owner.token))
			.send({ status: "READY" })
			.expect(409);
	});

	it("moves tickets by ticks and buttons, recalls served ones, and drops refunded ones", async () => {
		const croissant = owner.products.find((p) => p.name === "Croissant")!;
		const latte = owner.products.find((p) => p.name === "Latte")!;
		const id = await sell([
			{ productId: croissant.id, quantity: 1 },
			{ productId: latte.id, quantity: 1, modifierOptionIds: defaults(latte) },
		]);
		const lines = (await board()).open.find((t) => t.id === id)!.lines;
		const tick = (itemId: string, prepared: boolean) =>
			api(app)
				.patch(`${base}/kitchen/${id}/items/${itemId}`)
				.set(auth(owner.token))
				.send({ prepared })
				.expect(200);

		expect((await tick(lines[0].id, true)).body.data.status).toBe("PREPARING");
		expect((await tick(lines[1].id, true)).body.data.status).toBe("READY");
		expect((await tick(lines[1].id, false)).body.data.status).toBe("PREPARING");

		const ready = await api(app)
			.patch(`${base}/kitchen/${id}`)
			.set(auth(owner.token))
			.send({ status: "READY" })
			.expect(200);
		expect(
			ready.body.data.lines.every((l: { preparedAt: string | null }) => l.preparedAt)
		).toBe(true);
		await api(app)
			.patch(`${base}/kitchen/${id}`)
			.set(auth(owner.token))
			.send({ status: "SERVED" })
			.expect(200);
		const after = await board();
		expect(after.open.find((t) => t.id === id)).toBeUndefined();
		expect(after.recent[0].id).toBe(id);
		// Recall: served by mistake.
		await api(app)
			.patch(`${base}/kitchen/${id}`)
			.set(auth(owner.token))
			.send({ status: "READY" })
			.expect(200);
		expect((await board()).open.find((t) => t.id === id)?.status).toBe("READY");

		await api(app)
			.post(`${base}/orders/${id}/refund`)
			.set(auth(owner.token))
			.send({ reason: "ลูกค้ายกเลิก" })
			.expect(200);
		expect((await board()).open.find((t) => t.id === id)).toBeUndefined();
		await api(app)
			.patch(`${base}/kitchen/${id}`)
			.set(auth(owner.token))
			.send({ status: "SERVED" })
			.expect(409);
	});

	it("is for the kitchen role and the Pro plan and up", async () => {
		// Staff (kitchen crew) may use it by default.
		const invite = await api(app)
			.post(`${base}/members`)
			.set(auth(owner.token))
			.send({ email: `k-${randomUUID()}@e2e.test`, name: "Chef", role: "STAFF" })
			.expect(201);
		const reg = await api(app)
			.post("/api/v1/auth/register")
			.send({
				email: `c-${randomUUID()}@e2e.test`,
				password: "Passw0rd!x",
				name: "Chef",
			})
			.expect(201);
		const chef = reg.body.data.accessToken as string;
		await api(app)
			.post("/api/v1/invites/accept")
			.set(auth(chef))
			.send({ token: invite.body.data.inviteUrl.split("/invite/")[1] })
			.expect(200);
		await board(chef);
		// …and nothing else: no orders list, no POS.
		await api(app).get(`${base}/orders`).set(auth(chef)).expect(403);

		// Pro and up have the kitchen screen (QR rounds need it); Starter does not.
		const starter = await ownerWithShop(app, "STARTER");
		await api(app)
			.get(`/api/v1/businesses/${starter.businessId}/kitchen`)
			.set(auth(starter.token))
			.expect(403);
	});

	it("carries the service type and label to the order, the receipt and the ticket", async () => {
		const croissant = owner.products.find((p) => p.name === "Croissant")!;
		const checkout = (extra: object) =>
			api(app)
				.post(`${base}/orders`)
				.set(auth(owner.token))
				.send({
					clientOrderId: randomUUID(),
					items: [{ productId: croissant.id, quantity: 1 }],
					payment: { method: "CASH" },
					...extra,
				});
		const sale = await checkout({
			serviceType: "TAKEAWAY",
			label: "  คิว 12  ",
		}).expect(200);
		expect(sale.body.data).toMatchObject({
			serviceType: "TAKEAWAY",
			label: "คิว 12",
		});
		const ticket = (await board()).open.find(
			(t) => t.id === sale.body.data.id
		) as unknown as {
			serviceType: string;
			label: string;
		};
		expect(ticket).toMatchObject({ serviceType: "TAKEAWAY", label: "คิว 12" });

		// Both are optional; a blank label is no label.
		const plain = await checkout({ label: "   " }).expect(200);
		expect(plain.body.data).toMatchObject({ serviceType: null, label: null });

		await checkout({ serviceType: "DRIVE_THRU" }).expect(400);
		await checkout({ label: "x".repeat(41) }).expect(400);
	});
});
