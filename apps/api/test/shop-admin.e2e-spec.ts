import { api, bootApp, ownerWithShop } from "./helpers";
import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe("shop administration", () => {
	let app: INestApplication;
	let owner: Awaited<ReturnType<typeof ownerWithShop>>;
	let base: string;

	/** Invites a cashier and has them accept; returns their token and member id. */
	const joinAsCashier = async () => {
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
		const token = reg.body.data.accessToken as string;
		await api(app)
			.post("/api/v1/invites/accept")
			.set(auth(token))
			.send({ token: invite.body.data.inviteUrl.split("/invite/")[1] })
			.expect(200);
		return { token, memberId: invite.body.data.member.id as string };
	};

	beforeAll(async () => {
		app = await bootApp();
		owner = await ownerWithShop(app);
		base = `/api/v1/businesses/${owner.businessId}`;
	});
	afterAll(async () => {
		await app.close();
	});

	it("shows product cost only to members who can edit products", async () => {
		const cashier = await joinAsCashier();
		const asOwner = await api(app)
			.get(`${base}/products`)
			.set(auth(owner.token))
			.expect(200);
		expect(
			asOwner.body.data.some((p: { cost: number | null }) => p.cost !== null)
		).toBe(true);

		const asCashier = await api(app)
			.get(`${base}/products`)
			.set(auth(cashier.token))
			.expect(200);
		expect(asCashier.body.data.length).toBeGreaterThan(0);
		expect(
			asCashier.body.data.every((p: { cost: number | null }) => p.cost === null)
		).toBe(true);

		const one = await api(app)
			.get(`${base}/products/${asCashier.body.data[0].id}`)
			.set(auth(cashier.token))
			.expect(200);
		expect(one.body.data.cost).toBeNull();
	});

	it("disables a member at once, re-enables them, and changes their role", async () => {
		const cashier = await joinAsCashier();
		const member = `${base}/members/${cashier.memberId}`;

		await api(app)
			.patch(member)
			.set(auth(owner.token))
			.send({ status: "DISABLED" })
			.expect(200);
		await api(app).get(`${base}/orders`).set(auth(cashier.token)).expect(404);

		await api(app)
			.patch(member)
			.set(auth(owner.token))
			.send({ status: "ACTIVE" })
			.expect(200);
		await api(app).get(`${base}/orders`).set(auth(cashier.token)).expect(200);
		await api(app).get(`${base}/dashboard`).set(auth(cashier.token)).expect(403);

		const promoted = await api(app)
			.patch(member)
			.set(auth(owner.token))
			.send({ role: "MANAGER" })
			.expect(200);
		expect(promoted.body.data.role).toBe("MANAGER");
		await api(app).get(`${base}/dashboard`).set(auth(cashier.token)).expect(200);

		// A cashier cannot manage staff, and no one can become OWNER this way.
		await api(app)
			.patch(member)
			.set(auth(owner.token))
			.send({ role: "OWNER" })
			.expect(400);
	});

	it("cancels a pending invitation, killing its link, and allows re-inviting the email", async () => {
		const email = `p-${randomUUID()}@e2e.test`;
		const invite = await api(app)
			.post(`${base}/members`)
			.set(auth(owner.token))
			.send({ email, name: "Pending", role: "CASHIER" })
			.expect(201);
		const token = invite.body.data.inviteUrl.split("/invite/")[1];
		await api(app).get(`/api/v1/invites/${token}`).expect(200);

		await api(app)
			.delete(`${base}/members/${invite.body.data.member.id}`)
			.set(auth(owner.token))
			.expect(200);
		await api(app).get(`/api/v1/invites/${token}`).expect(404);
		const list = await api(app)
			.get(`${base}/members`)
			.set(auth(owner.token))
			.expect(200);
		expect(list.body.data.some((m: { email: string }) => m.email === email)).toBe(
			false
		);

		await api(app)
			.post(`${base}/members`)
			.set(auth(owner.token))
			.send({ email, name: "Pending", role: "CASHIER" })
			.expect(201);

		// A member who already joined is disabled, not deleted.
		const joined = await joinAsCashier();
		await api(app)
			.delete(`${base}/members/${joined.memberId}`)
			.set(auth(owner.token))
			.expect(400);
	});

	it("saves receipt settings", async () => {
		const res = await api(app)
			.patch(base)
			.set(auth(owner.token))
			.send({
				receiptFooter: "  ขอบคุณค่ะ แล้วพบกันใหม่  ",
				receiptShowLogo: false,
				receiptShowTaxId: false,
			})
			.expect(200);
		expect(res.body.data).toMatchObject({
			receiptFooter: "ขอบคุณค่ะ แล้วพบกันใหม่",
			receiptShowLogo: false,
			receiptShowTaxId: false,
		});
		const again = await api(app).get(base).set(auth(owner.token)).expect(200);
		expect(again.body.data.receiptFooter).toBe("ขอบคุณค่ะ แล้วพบกันใหม่");
		await api(app)
			.patch(base)
			.set(auth(owner.token))
			.send({ receiptFooter: "x".repeat(301) })
			.expect(400);
	});

	it("saves tax settings, checks the tax id, and prices new sales with them", async () => {
		const save = (body: object) =>
			api(app).patch(base).set(auth(owner.token)).send(body);
		// 123456789012 → check digit 1.
		await save({ taxId: "1234567890122" }).expect(400);
		const res = await save({
			taxId: "1234567890121",
			vatBasisPoints: 700,
			pricesIncludeVat: false,
		}).expect(200);
		expect(res.body.data).toMatchObject({
			taxId: "1234567890121",
			vatBasisPoints: 700,
			pricesIncludeVat: false,
		});

		const product = await api(app)
			.post(`${base}/products`)
			.set(auth(owner.token))
			.send({ name: "Tax test", price: 10_000 })
			.expect(201);
		const sell = () =>
			api(app)
				.post(`${base}/orders`)
				.set(auth(owner.token))
				.send({
					clientOrderId: randomUUID(),
					items: [{ productId: product.body.data.id, quantity: 1 }],
					payment: { method: "CARD" },
				})
				.expect(200);
		// VAT on top of the shelf price…
		expect((await sell()).body.data).toMatchObject({ vat: 700, total: 10_700 });
		// …or already inside it.
		await save({ pricesIncludeVat: true }).expect(200);
		expect((await sell()).body.data).toMatchObject({ vat: 654, total: 10_000 });

		const cleared = await save({ taxId: null, vatBasisPoints: 0 }).expect(200);
		expect(cleared.body.data).toMatchObject({ taxId: null, vatBasisPoints: 0 });
	});
});
