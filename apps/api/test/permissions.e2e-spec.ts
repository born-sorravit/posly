import { api, bootApp, ownerWithShop } from "./helpers";
import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe("custom permissions (Business plan)", () => {
	let app: INestApplication;
	let owner: Awaited<ReturnType<typeof ownerWithShop>>;
	let base: string;

	/** Invites someone with a role and has them accept; returns their token and member id. */
	const join = async (role: "MANAGER" | "CASHIER" | "STAFF") => {
		const invite = await api(app)
			.post(`${base}/members`)
			.set(auth(owner.token))
			.send({ email: `m-${randomUUID()}@e2e.test`, name: role, role })
			.expect(201);
		const reg = await api(app)
			.post("/api/v1/auth/register")
			.send({
				email: `u-${randomUUID()}@e2e.test`,
				password: "Passw0rd!x",
				name: role,
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
	const setPerms = (token: string, memberId: string, permissions: string[] | null) =>
		api(app)
			.put(`${base}/members/${memberId}/permissions`)
			.set(auth(token))
			.send({ permissions });
	const sell = (token: string) =>
		api(app)
			.post(`${base}/orders`)
			.set(auth(token))
			.send({
				clientOrderId: randomUUID(),
				items: [
					{
						productId: owner.products.find((p) => p.name === "Croissant")!.id,
						quantity: 1,
					},
				],
				payment: { method: "CARD" },
			})
			.expect(200);

	beforeAll(async () => {
		app = await bootApp();
		owner = await ownerWithShop(app, "BUSINESS");
		base = `/api/v1/businesses/${owner.businessId}`;
	});

	afterAll(async () => {
		await app.close();
	});

	it("lists role defaults without billing in what can be assigned", async () => {
		const res = await api(app)
			.get(`${base}/members/roles`)
			.set(auth(owner.token))
			.expect(200);
		expect(res.body.data.roles.CASHIER).toContain("pos:use");
		expect(res.body.data.assignable).not.toContain("subscription:manage");
		expect(res.body.data.assignable).toContain("orders:refund");
	});

	it("lets a cashier refund once granted, and takes it back", async () => {
		const cashier = await join("CASHIER");
		const order = (await sell(cashier.token)).body.data.id as string;
		const refund = () =>
			api(app)
				.post(`${base}/orders/${order}/refund`)
				.set(auth(cashier.token))
				.send({ reason: "ทดสอบ" });
		await refund().expect(403);

		const granted = await setPerms(owner.token, cashier.memberId, [
			"pos:use",
			"orders:refund",
		]).expect(200);
		// What a permission needs comes with it.
		expect(granted.body.data.permissions).toEqual(
			expect.arrayContaining([
				"pos:use",
				"orders:refund",
				"orders:read-own",
				"products:read",
			])
		);
		expect(granted.body.data.customPermissions).toBe(true);
		await refund().expect(200);

		const reset = await setPerms(owner.token, cashier.memberId, null).expect(200);
		expect(reset.body.data.customPermissions).toBe(false);
		expect(reset.body.data.permissions).not.toContain("orders:refund");
	});

	it("never grants billing, never edits the owner or yourself, and never grants beyond your own", async () => {
		const cashier = await join("CASHIER");
		await setPerms(owner.token, cashier.memberId, ["subscription:manage"]).expect(
			400
		);
		await setPerms(owner.token, cashier.memberId, ["not:a-permission"]).expect(400);

		const members = await api(app)
			.get(`${base}/members`)
			.set(auth(owner.token))
			.expect(200);
		const ownerId = members.body.data.find(
			(m: { role: string }) => m.role === "OWNER"
		).id;
		await setPerms(owner.token, ownerId, ["pos:use"]).expect(400);

		// A manager trusted with the team, but not with reports.
		const manager = await join("MANAGER");
		await setPerms(owner.token, manager.memberId, [
			"members:manage",
			"pos:use",
		]).expect(200);
		await setPerms(manager.token, manager.memberId, ["reports:read"]).expect(403);
		const beyond = await setPerms(manager.token, cashier.memberId, [
			"reports:read",
		]).expect(403);
		expect(beyond.body.message).toMatch(/reports:read/);
		await setPerms(manager.token, cashier.memberId, ["pos:use"]).expect(200);
	});

	it("resets a custom list when the role changes", async () => {
		const staff = await join("STAFF");
		await setPerms(owner.token, staff.memberId, ["pos:use"]).expect(200);
		const changed = await api(app)
			.patch(`${base}/members/${staff.memberId}`)
			.set(auth(owner.token))
			.send({ role: "CASHIER" })
			.expect(200);
		expect(changed.body.data.customPermissions).toBe(false);
	});

	it("is a Business feature", async () => {
		const pro = await ownerWithShop(app, "PRO");
		const proBase = `/api/v1/businesses/${pro.businessId}`;
		const invite = await api(app)
			.post(`${proBase}/members`)
			.set(auth(pro.token))
			.send({ email: `c-${randomUUID()}@e2e.test`, name: "C", role: "CASHIER" })
			.expect(201);
		await api(app)
			.put(`${proBase}/members/${invite.body.data.member.id}/permissions`)
			.set(auth(pro.token))
			.send({ permissions: ["pos:use"] })
			.expect(403);
	});
});
