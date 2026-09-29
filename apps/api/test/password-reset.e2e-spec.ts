import { api, bootApp } from "./helpers";
import { MailService, type Mail } from "@/shared/mail/mail.service";
import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";

describe("password reset", () => {
	let app: INestApplication;
	const sent: Mail[] = [];

	beforeAll(async () => {
		app = await bootApp();
		// Capture mail instead of sending it.
		jest.spyOn(app.get(MailService), "send").mockImplementation(async (mail) => {
			sent.push(mail);
		});
	});
	afterAll(async () => {
		await app.close();
	});

	const tokenFrom = (mail: Mail) =>
		mail.text.match(/reset-password\/([A-Za-z0-9_-]+)/)?.[1] as string;

	it("answers the same for unknown emails and sends nothing", async () => {
		const res = await api(app)
			.post("/api/v1/auth/forgot-password")
			.send({ email: `nobody-${randomUUID()}@e2e.test` })
			.expect(200);
		expect(res.body.data).toEqual({ sent: true });
		expect(sent).toHaveLength(0);
	});

	it("resets once, signs out everywhere, retires older links and refuses reuse", async () => {
		const email = `reset-${randomUUID()}@e2e.test`;
		const reg = await api(app)
			.post("/api/v1/auth/register")
			.send({ email, password: "OldPassw0rd!", name: "Reset" })
			.expect(201);
		const oldRefresh = reg.body.data.refreshToken as string;

		await api(app)
			.post("/api/v1/auth/forgot-password")
			.send({ email: email.toUpperCase() })
			.expect(200);
		await api(app).post("/api/v1/auth/forgot-password").send({ email }).expect(200);
		expect(sent).toHaveLength(2);
		const [first, second] = sent.map(tokenFrom);
		expect(sent[1].to).toBe(email);

		// Asking again retired the first link.
		await api(app)
			.post("/api/v1/auth/reset-password")
			.send({ token: first, newPassword: "NewPassw0rd!" })
			.expect(410);
		await api(app)
			.post("/api/v1/auth/reset-password")
			.send({ token: second, newPassword: "short" })
			.expect(400);
		await api(app)
			.post("/api/v1/auth/reset-password")
			.send({ token: second, newPassword: "NewPassw0rd!" })
			.expect(200);
		await api(app)
			.post("/api/v1/auth/reset-password")
			.send({ token: second, newPassword: "Another0ne!" })
			.expect(410);

		await api(app)
			.post("/api/v1/auth/login")
			.send({ email, password: "OldPassw0rd!" })
			.expect(401);
		await api(app)
			.post("/api/v1/auth/login")
			.send({ email, password: "NewPassw0rd!" })
			.expect(200);
		await api(app)
			.post("/api/v1/auth/refresh")
			.send({ refreshToken: oldRefresh })
			.expect(401);
	});
});
