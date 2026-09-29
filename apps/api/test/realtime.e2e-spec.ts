import { api, baseUrl, bootApp, ownerWithShop } from "./helpers";
import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

/** Reads a Server-Sent Events stream, collecting event names as they arrive. */
const openStream = async (url: string) => {
	const controller = new AbortController();
	const response = await fetch(url, { signal: controller.signal });
	const events: { name: string; data: string }[] = [];
	if (!response.ok || !response.body)
		return { status: response.status, events, close: () => controller.abort() };
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	void (async () => {
		try {
			for (;;) {
				const { value, done } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				let cut = buffer.indexOf("\n\n");
				while (cut >= 0) {
					const block = buffer.slice(0, cut);
					buffer = buffer.slice(cut + 2);
					const name = /^event: (.*)$/m.exec(block)?.[1] ?? "message";
					const data = /^data: (.*)$/m.exec(block)?.[1] ?? "";
					events.push({ name, data });
					cut = buffer.indexOf("\n\n");
				}
			}
		} catch {
			// Aborted.
		}
	})();
	return {
		status: response.status,
		headers: response.headers,
		events,
		close: () => controller.abort(),
	};
};

const waitFor = async (check: () => boolean, ms = 4000) => {
	const until = Date.now() + ms;
	while (Date.now() < until) {
		if (check()) return true;
		await new Promise((r) => setTimeout(r, 50));
	}
	return check();
};

describe("realtime stream (SSE)", () => {
	let app: INestApplication;
	let url: string;

	beforeAll(async () => {
		app = await bootApp();
		url = baseUrl(app);
	});

	afterAll(async () => {
		await app.close();
	});

	const ticketFor = async (owner: { token: string; businessId: string }) =>
		(
			await api(app)
				.post(`/api/v1/businesses/${owner.businessId}/realtime/ticket`)
				.set(auth(owner.token))
				.expect(200)
		).body.data.ticket as string;
	const sell = (owner: Awaited<ReturnType<typeof ownerWithShop>>) =>
		api(app)
			.post(`/api/v1/businesses/${owner.businessId}/orders`)
			.set(auth(owner.token))
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

	it("tells a shop's screens about its own sales, and nobody else's", async () => {
		const shop = await ownerWithShop(app, "BUSINESS");
		const other = await ownerWithShop(app, "BUSINESS");
		const stream = await openStream(
			`${url}/api/v1/realtime/stream?ticket=${encodeURIComponent(await ticketFor(shop))}`
		);
		try {
			expect(stream.status).toBe(200);
			expect(stream.headers?.get("content-type")).toMatch(/text\/event-stream/);
			expect(
				await waitFor(() => stream.events.some((e) => e.name === "ready"))
			).toBe(true);

			await sell(other);
			await new Promise((r) => setTimeout(r, 600));
			expect(stream.events.filter((e) => e.name === "orders")).toHaveLength(0);

			await sell(shop);
			expect(
				await waitFor(() => stream.events.some((e) => e.name === "orders"))
			).toBe(true);
			expect(
				await waitFor(() => stream.events.some((e) => e.name === "kitchen"))
			).toBe(true);
			// A signal, not the envelope-wrapped data.
			expect(stream.events.find((e) => e.name === "orders")?.data).toBe(
				'{"topic":"orders"}'
			);
		} finally {
			stream.close();
		}
	});

	it("refuses a missing, forged or foreign ticket", async () => {
		const shop = await ownerWithShop(app);
		const ticket = await ticketFor(shop);
		expect((await openStream(`${url}/api/v1/realtime/stream`)).status).toBe(401);
		const [body] = ticket.split(".");
		expect(
			(await openStream(`${url}/api/v1/realtime/stream?ticket=${body}.forged`))
				.status
		).toBe(401);

		// A ticket can only be had for a shop you belong to.
		const stranger = await ownerWithShop(app);
		await api(app)
			.post(`/api/v1/businesses/${shop.businessId}/realtime/ticket`)
			.set(auth(stranger.token))
			.expect(404);
	});
});
