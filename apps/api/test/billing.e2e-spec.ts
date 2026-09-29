import { AppModule } from "@/app.module";
import { STRIPE } from "@/modules/billing/stripe.provider";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import Stripe from "stripe";
import { DataSource } from "typeorm";
import { api, ownerWithShop, startApp } from "./helpers";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const SECRET = "whsec_e2e_test_secret";
const signer = new Stripe("sk_test_signing_only");

/**
 * Just enough of Stripe for the billing flow, with state: prices by lookup key, customers,
 * checkout sessions and subscriptions. Every call is recorded so tests can assert what
 * would have been sent.
 */
class FakeStripe {
	calls: { method: string; params: unknown }[] = [];
	priceStore = new Map<
		string,
		{ id: string; lookup_key: string; metadata: Record<string, string> }
	>();
	subStore = new Map<string, Stripe.Subscription>();
	private seq = 0;
	private id = (prefix: string) => `${prefix}_${++this.seq}`;
	private record = (method: string, params: unknown) =>
		this.calls.push({ method, params });

	webhooks = signer.webhooks;

	priceById = (id: string) => [...this.priceStore.values()].find((p) => p.id === id);

	prices = {
		list: async (params: { lookup_keys: string[] }) => {
			this.record("prices.list", params);
			const hit = this.priceStore.get(params.lookup_keys[0]);
			return { data: hit ? [hit] : [] };
		},
		create: async (params: {
			lookup_key: string;
			metadata: Record<string, string>;
		}) => {
			this.record("prices.create", params);
			const price = {
				id: this.id("price"),
				lookup_key: params.lookup_key,
				metadata: params.metadata,
			};
			this.priceStore.set(params.lookup_key, price);
			return price;
		},
	};
	customers = {
		create: async (params: unknown) => {
			this.record("customers.create", params);
			return { id: this.id("cus") };
		},
	};

	checkout = {
		sessions: {
			create: async (params: unknown) => {
				this.record("checkout.sessions.create", params);
				return { id: this.id("cs"), url: "https://checkout.stripe.test/session" };
			},
		},
	};

	billingPortal = {
		sessions: {
			create: async (params: unknown) => {
				this.record("billingPortal.sessions.create", params);
				return { url: "https://billing.stripe.test/portal" };
			},
		},
	};

	subscriptions = {
		retrieve: async (id: string) => {
			const sub = this.subStore.get(id);
			if (!sub) throw new Error(`No such subscription ${id}`);
			return sub;
		},
		update: async (
			id: string,
			params: {
				items?: { price: string }[];
				cancel_at_period_end?: boolean;
				metadata?: Record<string, string>;
			}
		) => {
			this.record("subscriptions.update", params);
			const sub = this.subStore.get(id);
			if (!sub) throw new Error(`No such subscription ${id}`);
			const price = params.items?.[0]
				? this.priceById(params.items[0].price)
				: undefined;
			const next = {
				...sub,
				cancel_at_period_end:
					params.cancel_at_period_end ?? sub.cancel_at_period_end,
				metadata: { ...sub.metadata, ...params.metadata },
				items: price
					? {
							...sub.items,
							data: [
								{
									...sub.items.data[0],
									price: { id: price.id, metadata: price.metadata },
								},
							],
						}
					: sub.items,
			} as Stripe.Subscription;
			this.subStore.set(id, next);
			return next;
		},
	};

	/** What Stripe does after a successful checkout: a live subscription on the customer. */
	subscribe(customer: string, priceId: string, metadata: Record<string, string>) {
		const price = this.priceById(priceId);
		const now = Math.floor(Date.now() / 1000);
		const sub = {
			id: this.id("sub"),
			object: "subscription",
			customer,
			status: "active",
			cancel_at_period_end: false,
			start_date: now,
			metadata,
			items: {
				data: [
					{
						id: this.id("si"),
						current_period_end: now + 30 * 86_400,
						price: { id: priceId, metadata: price?.metadata ?? {} },
					},
				],
			},
		} as unknown as Stripe.Subscription;
		this.subStore.set(sub.id, sub);
		return sub;
	}

	setStatus(id: string, status: Stripe.Subscription.Status) {
		const sub = this.subStore.get(id) as Stripe.Subscription;
		this.subStore.set(id, { ...sub, status });
	}
}

const makeFake = () => new FakeStripe();

describe("billing (Stripe)", () => {
	let app: INestApplication;
	let stripe: ReturnType<typeof makeFake>;

	const send = (event: object, signature?: string) => {
		const payload = JSON.stringify(event);
		return api(app)
			.post("/api/v1/billing/webhook")
			.set("Content-Type", "application/json")
			.set(
				"stripe-signature",
				signature ??
					signer.webhooks.generateTestHeaderString({ payload, secret: SECRET })
			)
			.send(payload);
	};
	const detail = async (owner: { token: string; businessId: string }) =>
		(
			await api(app)
				.get(`/api/v1/businesses/${owner.businessId}`)
				.set(auth(owner.token))
				.expect(200)
		).body.data.subscription;

	beforeAll(async () => {
		stripe = makeFake();
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
			.overrideProvider(STRIPE)
			.useValue(stripe)
			.compile();
		app = await startApp(moduleRef.createNestApplication({ rawBody: true }));
	});

	afterAll(async () => {
		await app.close();
	});

	it("checks out, activates by webhook, changes plan and cancels", async () => {
		const owner = await ownerWithShop(app, "FREE");
		const base = `/api/v1/businesses/${owner.businessId}/billing`;
		expect(await detail(owner)).toMatchObject({
			plan: "FREE",
			onlinePayment: true,
			billedOnline: false,
		});

		await api(app)
			.post(`${base}/checkout`)
			.set(auth(owner.token))
			.send({ plan: "FREE" })
			.expect(400);
		const checkout = await api(app)
			.post(`${base}/checkout`)
			.set(auth(owner.token))
			.send({ plan: "PRO" })
			.expect(200);
		expect(checkout.body.data.url).toBe("https://checkout.stripe.test/session");

		const session = stripe.calls.find((c) => c.method === "checkout.sessions.create")
			?.params as {
			customer: string;
			line_items: { price: string }[];
			client_reference_id: string;
			subscription_data: { metadata: Record<string, string> };
			success_url: string;
		};
		expect(session).toMatchObject({
			client_reference_id: owner.businessId,
			mode: "subscription",
		});
		expect(session.success_url).toMatch(
			/\/settings\/subscription\?checkout=success$/
		);
		// The price comes from the plan row and is created once.
		const created = stripe.calls.filter((c) => c.method === "prices.create");
		expect(created).toHaveLength(1);
		expect(created[0].params).toMatchObject({
			currency: "thb",
			unit_amount: 19_900,
			recurring: { interval: "month" },
		});

		// Nothing is granted until Stripe says it is paid.
		expect((await detail(owner)).plan).toBe("FREE");

		const sub = stripe.subscribe(
			session.customer,
			session.line_items[0].price,
			session.subscription_data.metadata
		);
		await send({
			id: "evt_1",
			type: "checkout.session.completed",
			data: {
				object: {
					id: "cs_1",
					object: "checkout.session",
					subscription: sub.id,
					client_reference_id: owner.businessId,
				},
			},
		}).expect(200);
		const paid = await detail(owner);
		expect(paid).toMatchObject({
			plan: "PRO",
			status: "ACTIVE",
			billedOnline: true,
			cancelAtPeriodEnd: false,
		});
		expect(new Date(paid.endDate).getTime()).toBeGreaterThan(
			Date.now() + 29 * 86_400_000
		);

		// A second checkout would double-bill.
		await api(app)
			.post(`${base}/checkout`)
			.set(auth(owner.token))
			.send({ plan: "BUSINESS" })
			.expect(409);

		await api(app)
			.post(`${base}/change`)
			.set(auth(owner.token))
			.send({ plan: "BUSINESS" })
			.expect(204);
		expect((await detail(owner)).plan).toBe("BUSINESS");
		const upgrade = stripe.calls
			.filter((c) => c.method === "subscriptions.update")
			.at(-1)?.params;
		expect(upgrade).toMatchObject({
			proration_behavior: "always_invoice",
			payment_behavior: "pending_if_incomplete",
		});

		await api(app)
			.post(`${base}/change`)
			.set(auth(owner.token))
			.send({ plan: "STARTER" })
			.expect(204);
		expect(
			stripe.calls.filter((c) => c.method === "subscriptions.update").at(-1)?.params
		).toMatchObject({
			proration_behavior: "create_prorations",
		});

		await api(app)
			.post(`${base}/change`)
			.set(auth(owner.token))
			.send({ plan: "FREE" })
			.expect(204);
		expect(await detail(owner)).toMatchObject({
			plan: "STARTER",
			cancelAtPeriodEnd: true,
		});

		const portal = await api(app)
			.post(`${base}/portal`)
			.set(auth(owner.token))
			.expect(200);
		expect(portal.body.data.url).toBe("https://billing.stripe.test/portal");

		// A declined renewal: Free limits and a notification for the owner, once.
		stripe.setStatus(sub.id, "past_due");
		const updated = {
			id: "evt_2",
			type: "customer.subscription.updated",
			data: { object: { id: sub.id, object: "subscription" } },
		};
		await send(updated).expect(200);
		await send({ ...updated, id: "evt_3" }).expect(200);
		expect(await detail(owner)).toMatchObject({
			plan: "FREE",
			subscribedPlan: "STARTER",
			status: "PAST_DUE",
		});
		const notes = await api(app)
			.get(`/api/v1/businesses/${owner.businessId}/notifications`)
			.set(auth(owner.token))
			.expect(200);
		expect(
			notes.body.data.items.filter(
				(n: { kind: string }) => n.kind === "PAYMENT_FAILED"
			)
		).toHaveLength(1);

		// Ended: back to Free, ready for a new checkout.
		stripe.setStatus(sub.id, "canceled");
		await send({
			id: "evt_4",
			type: "customer.subscription.deleted",
			data: { object: { id: sub.id, object: "subscription" } },
		}).expect(200);
		expect(await detail(owner)).toMatchObject({
			plan: "FREE",
			subscribedPlan: "FREE",
			billedOnline: false,
		});
		await api(app)
			.post(`${base}/checkout`)
			.set(auth(owner.token))
			.send({ plan: "PRO" })
			.expect(200);
		// The customer is reused, and so is the Price.
		expect(stripe.calls.filter((c) => c.method === "customers.create")).toHaveLength(
			1
		);
		expect(
			stripe.calls.filter(
				(c) =>
					c.method === "prices.create" &&
					(c.params as { lookup_key: string }).lookup_key === "posly_PRO_19900_thb"
			)
		).toHaveLength(1);
	});

	it("refuses unsigned webhooks and never applies a subscription to another shop", async () => {
		await send(
			{ id: "evt_x", type: "customer.subscription.updated", data: { object: {} } },
			"t=1,v1=bad"
		).expect(400);

		const victim = await ownerWithShop(app, "FREE");
		const attacker = await ownerWithShop(app, "FREE");
		await api(app)
			.post(`/api/v1/businesses/${victim.businessId}/billing/checkout`)
			.set(auth(victim.token))
			.send({ plan: "PRO" })
			.expect(200);
		const price = [...stripe.priceStore.values()][0].id;
		// Paid for by someone else's customer, but claiming the victim's shop in metadata.
		const sub = stripe.subscribe("cus_someone_else", price, {
			businessId: victim.businessId,
			plan: "BUSINESS",
		});
		await send({
			id: "evt_y",
			type: "customer.subscription.created",
			data: { object: { id: sub.id, object: "subscription" } },
		}).expect(200);
		expect((await detail(victim)).plan).toBe("FREE");
		expect((await detail(attacker)).plan).toBe("FREE");
	});

	it("only owners manage billing", async () => {
		const owner = await ownerWithShop(app, "FREE");
		const db = app.get(DataSource);
		await db.query(
			`UPDATE business_member SET role = 'MANAGER' WHERE business_id = $1`,
			[owner.businessId]
		);
		await api(app)
			.post(`/api/v1/businesses/${owner.businessId}/billing/checkout`)
			.set(auth(owner.token))
			.send({ plan: "PRO" })
			.expect(403);
	});
});
