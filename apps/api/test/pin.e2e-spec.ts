import { api, bootApp, ownerWithShop } from "./helpers";
import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe("PIN quick switch", () => {
	let app: INestApplication;
	let owner: Awaited<ReturnType<typeof ownerWithShop>>;
	let base: string;
	let cashier: { token: string; memberId: string; email: string };

	const join = async (role: "CASHIER" | "MANAGER") => {
		const invite = await api(app)
			.post(`${base}/members`)
			.set(auth(owner.token))
			.send({ email: `m-${randomUUID()}@e2e.test`, name: "Mind", role })
			.expect(201);
		const email = `u-${randomUUID()}@e2e.test`;
		const reg = await api(app)
			.post("/api/v1/auth/register")
			.send({ email, password: "Passw0rd!x", name: "Mind" })
			.expect(201);
		const token = reg.body.data.accessToken as string;
		await api(app)
			.post("/api/v1/invites/accept")
			.set(auth(token))
			.send({ token: invite.body.data.inviteUrl.split("/invite/")[1] })
			.expect(200);
		return { token, memberId: invite.body.data.member.id as string, email };
	};
	const pinLogin = (
		token: string,
		memberId: string,
		pin: string,
		businessId = owner.businessId
	) =>
		api(app)
			.post("/api/v1/auth/pin-login")
			.set(auth(token))
			.send({ businessId, memberId, pin });

	beforeAll(async () => {
		app = await bootApp();
		owner = await ownerWithShop(app);
		base = `/api/v1/businesses/${owner.businessId}`;
		cashier = await join("CASHIER");
	});

	afterAll(async () => {
		await app.close();
	});

	it("sets a PIN only with the account password", async () => {
		const set = (body: object) =>
			api(app).put(`${base}/members/me/pin`).set(auth(cashier.token)).send(body);
		await set({ pin: "4071" }).expect(403);
		await set({ pin: "4071", password: "wrong-password" }).expect(403);
		// Runs and repeats are allowed: the shop chooses, and five wrong tries still lock.
		await set({ pin: "0000", password: "Passw0rd!x" }).expect(204);
		await set({ pin: "1234", password: "Passw0rd!x" }).expect(204);
		await set({ pin: "12a4", password: "Passw0rd!x" }).expect(400);
		await set({ pin: "4071", password: "Passw0rd!x" }).expect(204);

		const roster = await api(app)
			.get(`${base}/members/roster`)
			.set(auth(owner.token))
			.expect(200);
		expect(
			roster.body.data.find((m: { id: string }) => m.id === cashier.memberId)
		).toMatchObject({
			hasPin: true,
			isYou: false,
			role: "CASHIER",
		});
		const members = await api(app)
			.get(`${base}/members`)
			.set(auth(owner.token))
			.expect(200);
		expect(
			members.body.data.find((m: { id: string }) => m.id === cashier.memberId).hasPin
		).toBe(true);
	});

	it("hands the till to the cashier: a session of their own account", async () => {
		const res = await pinLogin(owner.token, cashier.memberId, "4071").expect(200);
		expect(res.body.data.user.email).toBe(cashier.email);
		const token = res.body.data.accessToken as string;
		// Their permissions, not the owner's.
		const detail = await api(app).get(base).set(auth(token)).expect(200);
		expect(detail.body.data.role).toBe("CASHIER");
		await api(app).get(`${base}/dashboard?range=today`).set(auth(token)).expect(403);
	});

	it("locks the PIN after five wrong tries and says how many are left", async () => {
		const first = await pinLogin(owner.token, cashier.memberId, "9999").expect(401);
		expect(first.body.details).toEqual({ attemptsLeft: 4 });
		for (let i = 0; i < 4; i++)
			await pinLogin(owner.token, cashier.memberId, "9999").expect(401);
		const locked = await pinLogin(owner.token, cashier.memberId, "4071").expect(429);
		expect(locked.body.details.lockedUntil).toBeDefined();

		// An owner clearing the PIN also clears the lock; the cashier sets a new one.
		await api(app)
			.delete(`${base}/members/${cashier.memberId}/pin`)
			.set(auth(owner.token))
			.expect(204);
		await pinLogin(owner.token, cashier.memberId, "4071").expect(401);
		await api(app)
			.put(`${base}/members/me/pin`)
			.set(auth(cashier.token))
			.send({ pin: "5820", password: "Passw0rd!x" })
			.expect(204);
		await pinLogin(owner.token, cashier.memberId, "5820").expect(200);
	});

	it("does not count wrong PINs for a shared demo account, so it never locks", async () => {
		const demo = await join("CASHIER");
		await api(app)
			.put(`${base}/members/me/pin`)
			.set(auth(demo.token))
			.send({ pin: "2580", password: "Passw0rd!x" })
			.expect(204);
		// Registering on the demo domain is refused, so turn this account into one directly.
		await app
			.get(DataSource)
			.query(`UPDATE "user" SET email = $1 WHERE email = $2`, [
				`e2e-${randomUUID()}@demo.posly`,
				demo.email,
			]);

		for (let i = 0; i < 6; i++) {
			const wrong = await pinLogin(owner.token, demo.memberId, "9999").expect(401);
			expect(wrong.body.details).toBeUndefined();
		}
		await pinLogin(owner.token, demo.memberId, "2580").expect(200);
	});

	it("leaves a hidden member off the switch screen and refuses their PIN", async () => {
		const manager = await join("MANAGER");
		await api(app)
			.put(`${base}/members/me/pin`)
			.set(auth(manager.token))
			.send({ pin: "3691", password: "Passw0rd!x" })
			.expect(204);
		await pinLogin(owner.token, manager.memberId, "3691").expect(200);

		await api(app)
			.put(`${base}/members/me/switch-visibility`)
			.set(auth(manager.token))
			.send({ hidden: true })
			.expect(204);
		const others = await api(app)
			.get(`${base}/members/roster`)
			.set(auth(owner.token))
			.expect(200);
		expect(others.body.data.map((r: { id: string }) => r.id)).not.toContain(
			manager.memberId
		);
		// Knowing the PIN is not enough once hidden.
		await pinLogin(owner.token, manager.memberId, "3691").expect(401);
		// They still see themselves, flagged, so they can switch it back on.
		const own = await api(app)
			.get(`${base}/members/roster`)
			.set(auth(manager.token))
			.expect(200);
		expect(own.body.data.find((r: { isYou: boolean }) => r.isYou)).toMatchObject({
			id: manager.memberId,
			hiddenFromSwitch: true,
		});

		await api(app)
			.put(`${base}/members/me/switch-visibility`)
			.set(auth(manager.token))
			.send({ hidden: false })
			.expect(204);
		await pinLogin(owner.token, manager.memberId, "3691").expect(200);
	});

	it("refuses to register an address on the demo domain", async () => {
		await api(app)
			.post("/api/v1/auth/register")
			.send({
				email: `x-${randomUUID()}@demo.posly`,
				password: "Passw0rd!x",
				name: "X",
			})
			.expect(400);
	});

	it("only works from a till already signed in to the same shop", async () => {
		const outsider = await ownerWithShop(app);
		await pinLogin(outsider.token, cashier.memberId, "5820").expect(403);
		// Their own shop id with our member: no such member there.
		await pinLogin(
			outsider.token,
			cashier.memberId,
			"5820",
			outsider.businessId
		).expect(401);

		// A disabled member cannot be switched to.
		await api(app)
			.patch(`${base}/members/${cashier.memberId}`)
			.set(auth(owner.token))
			.send({ status: "DISABLED" })
			.expect(200);
		await pinLogin(owner.token, cashier.memberId, "5820").expect(401);
		await api(app)
			.patch(`${base}/members/${cashier.memberId}`)
			.set(auth(owner.token))
			.send({ status: "ACTIVE" })
			.expect(200);

		// Nor may a cashier clear someone else's PIN.
		const members = await api(app)
			.get(`${base}/members`)
			.set(auth(owner.token))
			.expect(200);
		const ownerId = members.body.data.find(
			(m: { role: string }) => m.role === "OWNER"
		).id;
		await api(app)
			.delete(`${base}/members/${ownerId}/pin`)
			.set(auth(cashier.token))
			.expect(403);
		await api(app)
			.delete(`${base}/members/me/pin`)
			.set(auth(cashier.token))
			.expect(204);
		const hash = await app
			.get(DataSource)
			.query(`SELECT pin_hash FROM business_member WHERE id = $1`, [
				cashier.memberId,
			]);
		expect(hash[0].pin_hash).toBeNull();
	});
});
