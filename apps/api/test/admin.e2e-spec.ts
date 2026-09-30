import { api, bootApp, ownerWithShop } from "./helpers";
import type { INestApplication } from "@nestjs/common";
import { DataSource } from "typeorm";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe("platform admin", () => {
	let app: INestApplication;
	let admin: Awaited<ReturnType<typeof ownerWithShop>>;
	let owner: Awaited<ReturnType<typeof ownerWithShop>>;

	beforeAll(async () => {
		app = await bootApp();
		admin = await ownerWithShop(app);
		owner = await ownerWithShop(app);
		await app
			.get(DataSource)
			.query(`UPDATE "user" SET is_platform_admin = true WHERE email = $1`, [
				admin.email,
			]);
	});
	afterAll(async () => {
		await app.close();
	});

	it("answers 401 without a session and 404 to a signed-in non-admin", async () => {
		await api(app).get("/api/v1/admin/overview").expect(401);
		for (const path of [
			"overview",
			"businesses",
			"users",
			"system",
			`businesses/${owner.businessId}`,
		]) {
			await api(app).get(`/api/v1/admin/${path}`).set(auth(owner.token)).expect(404);
		}
	});

	it("reports the flag on /auth/me", async () => {
		const me = await api(app)
			.get("/api/v1/auth/me")
			.set(auth(admin.token))
			.expect(200);
		expect(me.body.data.isPlatformAdmin).toBe(true);
		const other = await api(app)
			.get("/api/v1/auth/me")
			.set(auth(owner.token))
			.expect(200);
		expect(other.body.data.isPlatformAdmin).toBe(false);
	});

	it("serves the overview with one point per day", async () => {
		const res = await api(app)
			.get("/api/v1/admin/overview?days=7")
			.set(auth(admin.token))
			.expect(200);
		expect(res.body.data.days).toBe(7);
		expect(res.body.data.series).toHaveLength(7);
		expect(res.body.data.totals.businesses).toBeGreaterThanOrEqual(2);
		expect(typeof res.body.data.totals.gmvPeriod).toBe("number");
	});

	it("lists and finds shops, and shows one in detail", async () => {
		const list = await api(app)
			.get("/api/v1/admin/businesses")
			.query({ search: owner.email })
			.set(auth(admin.token))
			.expect(200);
		expect(list.body.meta.total).toBe(1);
		expect(list.body.data[0]).toMatchObject({
			id: owner.businessId,
			ownerEmail: owner.email,
			plan: "PRO",
		});

		const detail = await api(app)
			.get(`/api/v1/admin/businesses/${owner.businessId}`)
			.set(auth(admin.token))
			.expect(200);
		expect(detail.body.data.business.id).toBe(owner.businessId);
		expect(detail.body.data.series).toHaveLength(30);
		// Members never carry their PIN or invite secrets.
		expect(JSON.stringify(detail.body.data.members)).not.toMatch(
			/pin_?hash|invite_?token/i
		);

		await api(app)
			.get("/api/v1/admin/businesses/00000000-0000-4000-8000-000000000000")
			.set(auth(admin.token))
			.expect(404);
	});

	it("serves users, subscriptions, activity and system status", async () => {
		const users = await api(app)
			.get("/api/v1/admin/users")
			.query({ search: admin.email })
			.set(auth(admin.token))
			.expect(200);
		expect(users.body.data[0]).toMatchObject({
			email: admin.email,
			isPlatformAdmin: true,
			shops: 1,
		});

		await api(app)
			.get("/api/v1/admin/subscriptions?status=ACTIVE")
			.set(auth(admin.token))
			.expect(200);
		await api(app)
			.get("/api/v1/admin/subscriptions/summary")
			.set(auth(admin.token))
			.expect(200);
		await api(app).get("/api/v1/admin/activity").set(auth(admin.token)).expect(200);
		await api(app)
			.get("/api/v1/admin/orders/recent")
			.set(auth(admin.token))
			.expect(200);

		const system = await api(app)
			.get("/api/v1/admin/system")
			.set(auth(admin.token))
			.expect(200);
		expect(system.body.data.database.up).toBe(true);
		// Only whether an integration is configured, never its secret.
		expect(typeof system.body.data.integrations.stripe).toBe("boolean");
	});

	it("rejects a bad filter instead of ignoring it", async () => {
		await api(app)
			.get("/api/v1/admin/subscriptions?status=NOPE")
			.set(auth(admin.token))
			.expect(400);
		await api(app)
			.get("/api/v1/admin/overview?days=1000")
			.set(auth(admin.token))
			.expect(400);
	});
});
