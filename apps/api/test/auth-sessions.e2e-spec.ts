import { api, bootApp } from "./helpers";
import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";

/** e2e-setup shortens the reuse grace window to 1s; wait just past it. */
const pastGrace = () => new Promise((resolve) => setTimeout(resolve, 1100));

describe("refresh token families", () => {
	let app: INestApplication;

	const signUp = async () => {
		const email = `family-${randomUUID()}@e2e.test`;
		const res = await api(app)
			.post("/api/v1/auth/register")
			.set("User-Agent", "Mozilla/5.0 (iPhone) Safari/605.1")
			.send({ email, password: "Passw0rd!x", name: "Family" })
			.expect(201);
		return {
			userId: res.body.data.user.id as string,
			token: res.body.data.refreshToken as string,
		};
	};
	const refresh = (token: string) =>
		api(app).post("/api/v1/auth/refresh").send({ refreshToken: token });
	const active = async (userId: string) =>
		(await app
			.get(DataSource)
			.query(
				`SELECT user_agent FROM refresh_token WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()`,
				[userId]
			)) as { user_agent: string | null }[];

	beforeAll(async () => {
		app = await bootApp();
	});
	afterAll(async () => {
		await app.close();
	});

	it("records the device the request came from", async () => {
		const { userId } = await signUp();
		expect(await active(userId)).toEqual([
			{ user_agent: "Mozilla/5.0 (iPhone) Safari/605.1" },
		]);
	});

	it("keeps a concurrent refresh working, then retires the unused sibling", async () => {
		const { userId, token } = await signUp();

		// Two requests refresh with the same token at once: the second lands in the grace
		// window and is handed a sibling. Both must work — either may be the one stored.
		const first = await refresh(token).expect(200);
		const second = await refresh(token).expect(200);
		expect(await active(userId)).toHaveLength(2);

		// The client kept the second. Its next rotation retires the first, now past the window.
		await pastGrace();
		const next = await refresh(second.body.data.refreshToken).expect(200);
		expect(await active(userId)).toHaveLength(1);
		await refresh(first.body.data.refreshToken).expect(401);
		await refresh(next.body.data.refreshToken).expect(200);
	});

	it("does not retire a sibling minted in the same moment", async () => {
		const { userId, token } = await signUp();
		const [a, b] = await Promise.all([refresh(token), refresh(token)]);
		expect(a.status).toBe(200);
		expect(b.status).toBe(200);
		// Whichever the browser stored still refreshes.
		await refresh(a.body.data.refreshToken).expect(200);
		await refresh(b.body.data.refreshToken).expect(200);
		expect((await active(userId)).length).toBeGreaterThanOrEqual(1);
	});

	it("signs the whole sign-in out, siblings included", async () => {
		const { userId, token } = await signUp();
		const first = await refresh(token).expect(200);
		await refresh(token).expect(200);
		expect(await active(userId)).toHaveLength(2);

		await api(app)
			.post("/api/v1/auth/logout")
			.send({ refreshToken: first.body.data.refreshToken })
			.expect((res) => expect(res.status).toBeLessThan(300));
		expect(await active(userId)).toHaveLength(0);
	});

	it("leaves other sign-ins alone", async () => {
		const { userId, token } = await signUp();
		const email = (
			await app
				.get(DataSource)
				.query(`SELECT email FROM "user" WHERE id = $1`, [userId])
		)[0].email as string;
		await api(app)
			.post("/api/v1/auth/login")
			.send({ email, password: "Passw0rd!x" })
			.expect(200);
		await pastGrace();
		await refresh(token).expect(200);
		// The login on the other device keeps its session.
		expect(await active(userId)).toHaveLength(2);
	});
});
