import { api, startApp } from "./helpers";
import { AppModule } from "@/app.module";
import { GoogleIdentity } from "@/modules/auth/google-identity.service";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

/** With ADMIN_REQUIRE_GOOGLE on, the monitor takes only sessions signed in with Google. */
describe("admin requires a Google sign-in", () => {
	let app: INestApplication;
	const email = `google-admin-${randomUUID()}@e2e.test`;

	beforeAll(async () => {
		process.env.ADMIN_REQUIRE_GOOGLE = "true";
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
			.overrideProvider(GoogleIdentity)
			// Any id token "verifies" as this one person.
			.useValue({
				verify: async () => ({
					sub: `g-${email}`,
					email,
					name: "Google Admin",
					picture: null,
				}),
			})
			.compile();
		app = await startApp(moduleRef.createNestApplication({ rawBody: true }));
	});
	afterAll(async () => {
		delete process.env.ADMIN_REQUIRE_GOOGLE;
		await app.close();
	});

	it("refuses a password session of an admin, and accepts it after Google", async () => {
		const registered = await api(app)
			.post("/api/v1/auth/register")
			.send({ email, password: "Passw0rd!x", name: "Google Admin" })
			.expect(201);
		await app
			.get(DataSource)
			.query(`UPDATE "user" SET is_platform_admin = true WHERE email = $1`, [email]);

		const password = registered.body.data.accessToken as string;
		const refused = await api(app)
			.get("/api/v1/admin/session")
			.set(auth(password))
			.expect(403);
		expect(refused.body.details).toEqual({ code: "ADMIN_GOOGLE_REQUIRED" });

		const google = await api(app)
			.post("/api/v1/auth/google")
			.send({ idToken: "fake" })
			.expect(200);
		const ok = await api(app)
			.get("/api/v1/admin/session")
			.set(auth(google.body.data.accessToken))
			.expect(200);
		expect(ok.body.data).toEqual({ ok: true, authMethod: "google" });

		// A refresh keeps the method: the rotated session is still a Google one.
		const rotated = await api(app)
			.post("/api/v1/auth/refresh")
			.send({ refreshToken: google.body.data.refreshToken })
			.expect(200);
		await api(app)
			.get("/api/v1/admin/overview")
			.set(auth(rotated.body.data.accessToken))
			.expect(200);
	});

	it("still hides the surface from non-admins with a 404", async () => {
		const other = await api(app)
			.post("/api/v1/auth/register")
			.send({
				email: `plain-${randomUUID()}@e2e.test`,
				password: "Passw0rd!x",
				name: "Plain",
			})
			.expect(201);
		await api(app)
			.get("/api/v1/admin/session")
			.set(auth(other.body.data.accessToken))
			.expect(404);
	});
});
