import { api, bootApp, ownerWithShop } from "./helpers";
import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe("modifier groups", () => {
	let app: INestApplication;

	beforeAll(async () => {
		app = await bootApp();
	});
	afterAll(async () => {
		await app.close();
	});

	it("creates, attaches, edits in place, and deletes an option group", async () => {
		const owner = await ownerWithShop(app);
		const base = `/api/v1/businesses/${owner.businessId}`;
		const croissant = owner.products.find((p) => p.name === "Croissant")!;

		const bad = (body: object) =>
			api(app)
				.post(`${base}/modifier-groups`)
				.set(auth(owner.token))
				.send(body)
				.expect(400);
		await bad({ name: "ท็อปปิ้ง", selection: "SINGLE", required: false, options: [] });
		await bad({
			name: "ท็อปปิ้ง",
			selection: "SINGLE",
			required: false,
			options: [
				{ name: "เนย", priceDelta: 0 },
				{ name: "เนย ", priceDelta: 500 },
			],
		});
		await bad({
			name: "ท็อปปิ้ง",
			selection: "SINGLE",
			required: false,
			options: [
				{ name: "เนย", priceDelta: 0, isDefault: true },
				{ name: "แยม", priceDelta: 500, isDefault: true },
			],
		});

		const created = await api(app)
			.post(`${base}/modifier-groups`)
			.set(auth(owner.token))
			.send({
				name: "  ท็อปปิ้ง ",
				selection: "MULTIPLE",
				required: false,
				options: [
					{ name: "เนย", priceDelta: 1000 },
					{ name: "แยม", priceDelta: 1500 },
				],
			})
			.expect(201);
		const group = created.body.data;
		expect(group.name).toBe("ท็อปปิ้ง");
		const [butter, jam] = group.options;

		await api(app)
			.patch(`${base}/products/${croissant.id}`)
			.set(auth(owner.token))
			.send({ modifierGroupIds: [group.id] })
			.expect(200);
		const list = await api(app)
			.get(`${base}/modifier-groups`)
			.set(auth(owner.token))
			.expect(200);
		expect(
			list.body.data.find((g: { id: string }) => g.id === group.id).productCount
		).toBe(1);

		// Rename butter and raise its price, drop jam, add honey.
		const updated = await api(app)
			.put(`${base}/modifier-groups/${group.id}`)
			.set(auth(owner.token))
			.send({
				name: "ท็อปปิ้ง",
				selection: "MULTIPLE",
				required: false,
				options: [
					{ id: butter.id, name: "เนยสด", priceDelta: 1200 },
					{ name: "น้ำผึ้ง", priceDelta: 800 },
				],
			})
			.expect(200);
		expect(updated.body.data.options.map((o: { name: string }) => o.name)).toEqual([
			"เนยสด",
			"น้ำผึ้ง",
		]);
		expect(updated.body.data.options[0].id).toBe(butter.id);

		const sale = (optionIds: string[]) =>
			api(app)
				.post(`${base}/orders`)
				.set(auth(owner.token))
				.send({
					clientOrderId: randomUUID(),
					items: [
						{ productId: croissant.id, quantity: 1, modifierOptionIds: optionIds },
					],
					payment: { method: "CARD" },
				});
		const kept = await sale([butter.id]).expect(200);
		expect(kept.body.data.total).toBe(croissant.price + 1200);
		await sale([jam.id]).expect(400);

		await api(app)
			.put(`${base}/modifier-groups/${group.id}`)
			.set(auth(owner.token))
			.send({
				name: "x",
				selection: "MULTIPLE",
				required: false,
				options: [{ id: randomUUID(), name: "y", priceDelta: 0 }],
			})
			.expect(400);

		await api(app)
			.delete(`${base}/modifier-groups/${group.id}`)
			.set(auth(owner.token))
			.expect(200);
		const product = await api(app)
			.get(`${base}/products/${croissant.id}`)
			.set(auth(owner.token))
			.expect(200);
		expect(product.body.data.modifierGroups).toEqual([]);
		// The earlier sale still reads the option it was sold with.
		const order = await api(app)
			.get(`${base}/orders/${kept.body.data.id}`)
			.set(auth(owner.token))
			.expect(200);
		expect(order.body.data.items[0].modifiers[0].optionName).toBe("เนยสด");
	});
});
