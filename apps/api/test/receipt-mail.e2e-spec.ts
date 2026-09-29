import { MailService } from "@/shared/mail/mail.service";
import { api, bootApp, ownerWithShop } from "./helpers";
import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe("receipt by email", () => {
	let app: INestApplication;
	let owner: Awaited<ReturnType<typeof ownerWithShop>>;
	let base: string;
	let send: jest.SpyInstance;

	beforeAll(async () => {
		app = await bootApp();
		owner = await ownerWithShop(app);
		base = `/api/v1/businesses/${owner.businessId}`;
		send = jest.spyOn(app.get(MailService), "send");
	});

	afterAll(async () => {
		await app.close();
	});

	const sell = async (token = owner.token) =>
		(
			await api(app)
				.post(`${base}/orders`)
				.set(auth(token))
				.send({
					clientOrderId: randomUUID(),
					items: [
						{
							productId: owner.products.find((p) => p.name === "Croissant")!.id,
							quantity: 2,
							note: '<img src=x onerror="alert(1)">',
						},
					],
					payment: { method: "CASH", received: 50_000 },
					serviceType: "TAKEAWAY",
					label: "คิว 1",
				})
				.expect(200)
		).body.data as { id: string; number: string };

	it("sends the receipt as the printed slip has it, with typed text escaped", async () => {
		const order = await sell();
		const res = await api(app)
			.post(`${base}/orders/${order.id}/receipt-email`)
			.set(auth(owner.token))
			.send({ email: "  Customer@Example.com " })
			.expect(200);
		// No Resend key in tests: accepted, but honestly reported as not delivered.
		expect(res.body.data).toEqual({ delivered: false });

		const mail = send.mock.calls.at(-1)?.[0] as {
			to: string;
			subject: string;
			html: string;
			text: string;
		};
		expect(mail.to).toBe("customer@example.com");
		expect(mail.subject).toContain(`#${order.number}`);
		expect(mail.html).toContain("กลับบ้าน · คิว 1");
		expect(mail.html).toContain("เงินทอน");
		expect(mail.html).not.toContain("<img src=x");
		expect(mail.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
		expect(mail.text).toContain("Croissant × 2");

		await api(app)
			.post(`${base}/orders/${order.id}/receipt-email`)
			.set(auth(owner.token))
			.send({ email: "not-an-email" })
			.expect(400);
	});

	it("only for orders the sender may see", async () => {
		const order = await sell();
		const invite = await api(app)
			.post(`${base}/members`)
			.set(auth(owner.token))
			.send({ email: `c-${randomUUID()}@e2e.test`, name: "Mind", role: "CASHIER" })
			.expect(201);
		const reg = await api(app)
			.post("/api/v1/auth/register")
			.send({
				email: `m-${randomUUID()}@e2e.test`,
				password: "Passw0rd!x",
				name: "Mind",
			})
			.expect(201);
		const cashier = reg.body.data.accessToken as string;
		await api(app)
			.post("/api/v1/invites/accept")
			.set(auth(cashier))
			.send({ token: invite.body.data.inviteUrl.split("/invite/")[1] })
			.expect(200);
		// The owner's sale is not the cashier's to send.
		await api(app)
			.post(`${base}/orders/${order.id}/receipt-email`)
			.set(auth(cashier))
			.send({ email: "a@example.com" })
			.expect(404);
	});
});
