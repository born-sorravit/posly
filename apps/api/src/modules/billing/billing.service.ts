import { BusinessMember } from "@/models/businesses/entities/business-member.entity";
import { Business } from "@/models/businesses/entities/business.entity";
import { SubscriptionPlan } from "@/models/subscriptions/entities/subscription-plan.entity";
import { Subscription } from "@/models/subscriptions/entities/subscription.entity";
import { STRIPE, type StripeClient } from "@/modules/billing/stripe.provider";
import { NotificationsService } from "@/modules/notifications/notifications.service";
import { EntitlementsService } from "@/modules/subscriptions/entitlements.service";
import type { ResolvedMembership } from "@/shared/decorators/current-membership.decorator";
import { MemberRole } from "@/shared/enums/member-role.enum";
import { NotificationKind } from "@/shared/enums/notification.enum";
import { PlanCode, SubscriptionStatus } from "@/shared/enums/subscription.enum";
import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type Stripe from "stripe";
import { DataSource } from "typeorm";

/** Stripe's subscription states, as the entitlements understand them. */
const STATUS: Partial<Record<Stripe.Subscription.Status, SubscriptionStatus>> = {
	active: SubscriptionStatus.ACTIVE,
	trialing: SubscriptionStatus.TRIALING,
	past_due: SubscriptionStatus.PAST_DUE,
	unpaid: SubscriptionStatus.PAST_DUE,
	canceled: SubscriptionStatus.CANCELLED,
	incomplete_expired: SubscriptionStatus.CANCELLED,
};

/**
 * Paid plans through Stripe (plan §26).
 *
 * The plan table stays the price list: each plan's Stripe Price is found by lookup key
 * (`posly_PRO_19900_thb`) and created on first use, so a price change is a row change and
 * the next checkout simply uses a new Price. Stripe is the source of truth for *whether a
 * shop has paid*: every webhook re-reads the subscription from Stripe and copies its state
 * onto our row, so events arriving twice or out of order cannot leave it wrong.
 */
@Injectable()
export class BillingService {
	private readonly logger = new Logger(BillingService.name);
	private readonly prices = new Map<string, string>();

	constructor(
		@Inject(STRIPE) private readonly client: StripeClient | null,
		private readonly config: ConfigService,
		private readonly dataSource: DataSource,
		private readonly entitlements: EntitlementsService,
		private readonly notifications: NotificationsService
	) {}

	get enabled(): boolean {
		return this.client !== null;
	}

	private get stripe(): StripeClient {
		if (!this.client) {
			throw new ServiceUnavailableException("Online payment is not configured");
		}
		return this.client;
	}

	private get webUrl(): string {
		return this.config.get<string>("app.publicWebUrl", "http://localhost:3000");
	}

	private async paidPlan(code: PlanCode): Promise<SubscriptionPlan> {
		const plan = (await this.entitlements.plansByCode()).get(code);
		if (!plan || !plan.isPublic) throw new NotFoundException("Plan not found");
		if (plan.monthlyPrice <= 0)
			throw new BadRequestException("Free needs no payment");
		return plan;
	}

	/** The Stripe Price for a plan at its current amount, created the first time it is needed. */
	private async priceFor(plan: SubscriptionPlan): Promise<string> {
		const lookupKey = `posly_${plan.code}_${plan.monthlyPrice}_thb`;
		const cached = this.prices.get(lookupKey);
		if (cached) return cached;
		const found = await this.stripe.prices.list({
			lookup_keys: [lookupKey],
			active: true,
			limit: 1,
		});
		const price =
			found.data[0] ??
			(await this.stripe.prices.create({
				currency: "thb",
				unit_amount: plan.monthlyPrice,
				recurring: { interval: "month" },
				lookup_key: lookupKey,
				metadata: { plan: plan.code },
				product_data: { name: `Posly ${plan.name}`, metadata: { plan: plan.code } },
			}));
		this.prices.set(lookupKey, price.id);
		return price.id;
	}

	private async subscriptionRow(businessId: string): Promise<Subscription> {
		const row = await this.dataSource
			.getRepository(Subscription)
			.findOne({ where: { businessId } });
		if (!row) throw new NotFoundException("Subscription not found");
		return row;
	}

	/** One Stripe customer per shop, billed to the owner's email. */
	private async customerFor(businessId: string, row: Subscription): Promise<string> {
		if (row.stripeCustomerId) return row.stripeCustomerId;
		const business = await this.dataSource
			.getRepository(Business)
			.findOneOrFail({ where: { id: businessId } });
		const owner = await this.dataSource
			.getRepository(BusinessMember)
			.findOne({ where: { businessId, role: MemberRole.OWNER } });
		const customer = await this.stripe.customers.create({
			name: business.name,
			email: owner?.email,
			preferred_locales: ["th"],
			metadata: { businessId },
		});
		await this.dataSource
			.getRepository(Subscription)
			.update({ id: row.id }, { stripeCustomerId: customer.id });
		return customer.id;
	}

	/** Stripe Checkout for a shop without a paid subscription yet. */
	async checkout(
		membership: ResolvedMembership,
		code: PlanCode
	): Promise<{ url: string }> {
		const plan = await this.paidPlan(code);
		const row = await this.subscriptionRow(membership.businessId);
		if (row.stripeSubscriptionId) {
			throw new ConflictException("Already subscribed; change the plan instead");
		}
		const [price, customer] = await Promise.all([
			this.priceFor(plan),
			this.customerFor(membership.businessId, row),
		]);
		const back = `${this.webUrl}/settings/subscription`;
		const session = await this.stripe.checkout.sessions.create({
			mode: "subscription",
			customer,
			client_reference_id: membership.businessId,
			line_items: [{ price, quantity: 1 }],
			subscription_data: {
				metadata: { businessId: membership.businessId, plan: plan.code },
			},
			metadata: { businessId: membership.businessId, plan: plan.code },
			allow_promotion_codes: true,
			locale: "th",
			success_url: `${back}?checkout=success`,
			cancel_url: `${back}?checkout=cancelled`,
		});
		if (!session.url)
			throw new ServiceUnavailableException("Stripe returned no checkout page");
		return { url: session.url };
	}

	/**
	 * Moves a paying shop to another plan. Upgrades are charged now, prorated; downgrades
	 * credit the difference to the next invoice; Free cancels at the end of the paid month.
	 * Choosing the current plan again undoes a pending cancellation.
	 */
	async changePlan(membership: ResolvedMembership, code: PlanCode): Promise<void> {
		const row = await this.subscriptionRow(membership.businessId);
		if (!row.stripeSubscriptionId)
			throw new ConflictException("No paid subscription to change");
		const current = await this.stripe.subscriptions.retrieve(
			row.stripeSubscriptionId
		);

		let updated: Stripe.Subscription;
		if (code === PlanCode.FREE) {
			updated = await this.stripe.subscriptions.update(current.id, {
				cancel_at_period_end: true,
			});
		} else {
			const plan = await this.paidPlan(code);
			const plans = await this.entitlements.plansByCode();
			const from = plans.get(row.planCode);
			const upgrade = (from?.monthlyPrice ?? 0) < plan.monthlyPrice;
			const items = [
				{ id: current.items.data[0].id, price: await this.priceFor(plan) },
			];
			if (upgrade) {
				// Charged now; if the card fails the old plan stays (a pending update) rather than
				// an unpaid new one. A pending update accepts only item and proration parameters,
				// so undoing a scheduled cancellation is a second call.
				updated = await this.stripe.subscriptions.update(current.id, {
					items,
					proration_behavior: "always_invoice",
					payment_behavior: "pending_if_incomplete",
				});
				if (updated.cancel_at_period_end) {
					updated = await this.stripe.subscriptions.update(current.id, {
						cancel_at_period_end: false,
					});
				}
			} else {
				updated = await this.stripe.subscriptions.update(current.id, {
					items,
					proration_behavior: "create_prorations",
					cancel_at_period_end: false,
				});
			}
		}
		await this.apply(updated, membership.businessId);
	}

	/** Stripe's customer portal: card, invoices and receipts, cancelling. */
	async portal(membership: ResolvedMembership): Promise<{ url: string }> {
		const row = await this.subscriptionRow(membership.businessId);
		if (!row.stripeCustomerId) throw new ConflictException("No billing account yet");
		const session = await this.stripe.billingPortal.sessions.create({
			customer: row.stripeCustomerId,
			return_url: `${this.webUrl}/settings/subscription`,
			locale: "th",
		});
		return { url: session.url };
	}

	/** Verifies and handles one webhook call. Unknown events are acknowledged and ignored. */
	async webhook(
		rawBody: Buffer | undefined,
		signature: string | undefined
	): Promise<void> {
		const secret = this.config.get<string>("billing.stripeWebhookSecret");
		if (!secret)
			throw new ServiceUnavailableException("Webhook secret is not configured");
		if (!rawBody || !signature)
			throw new BadRequestException("Missing Stripe signature");

		let event: Stripe.Event;
		try {
			event = this.stripe.webhooks.constructEvent(rawBody, signature, secret);
		} catch {
			throw new BadRequestException("Invalid Stripe signature");
		}

		switch (event.type) {
			case "checkout.session.completed": {
				const session = event.data.object;
				const id =
					typeof session.subscription === "string"
						? session.subscription
						: session.subscription?.id;
				if (id) await this.sync(id, session.client_reference_id ?? undefined);
				break;
			}
			case "customer.subscription.created":
			case "customer.subscription.updated":
			case "customer.subscription.deleted":
				await this.sync(event.data.object.id);
				break;
			default:
				break;
		}
	}

	/** Re-reads a subscription from Stripe, so the row follows Stripe's latest word. */
	private async sync(subscriptionId: string, businessHint?: string): Promise<void> {
		const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
		await this.apply(subscription, businessHint);
	}

	/** Copies a Stripe subscription's state onto the shop's row. */
	private async apply(
		subscription: Stripe.Subscription,
		businessHint?: string
	): Promise<void> {
		const customerId =
			typeof subscription.customer === "string"
				? subscription.customer
				: subscription.customer.id;
		const repo = this.dataSource.getRepository(Subscription);
		const businessId = subscription.metadata.businessId ?? businessHint;
		const row = businessId
			? await repo.findOne({ where: { businessId } })
			: await repo.findOne({ where: { stripeCustomerId: customerId } });
		// A subscription is only ever applied to the shop whose Stripe customer pays for it.
		if (!row || (row.stripeCustomerId && row.stripeCustomerId !== customerId)) {
			this.logger.warn(
				`Stripe subscription ${subscription.id} matches no shop; ignored`
			);
			return;
		}
		// An older subscription's late events must not overwrite a newer one.
		if (row.stripeSubscriptionId && row.stripeSubscriptionId !== subscription.id) {
			this.logger.warn(
				`Stripe subscription ${subscription.id} is not the shop's current one; ignored`
			);
			return;
		}
		// Not paid for yet (3-D Secure pending and the like): nothing to grant.
		if (subscription.status === "incomplete" || subscription.status === "paused")
			return;

		const status = STATUS[subscription.status] ?? SubscriptionStatus.CANCELLED;
		const item = subscription.items.data[0];
		const plan = item?.price.metadata.plan ?? subscription.metadata.plan;
		const wasPastDue = row.status === SubscriptionStatus.PAST_DUE;

		if (status === SubscriptionStatus.CANCELLED) {
			// Back to Free, open-ended; the customer stays for a later checkout.
			await repo.update(
				{ id: row.id },
				{
					planCode: PlanCode.FREE,
					status: SubscriptionStatus.ACTIVE,
					endDate: null,
					cancelAtPeriodEnd: false,
					stripeCustomerId: customerId,
					stripeSubscriptionId: null,
				}
			);
			return;
		}

		await repo.update(
			{ id: row.id },
			{
				...(plan && Object.values(PlanCode).includes(plan as PlanCode)
					? { planCode: plan }
					: {}),
				status,
				startDate: new Date(subscription.start_date * 1000),
				endDate: item ? new Date(item.current_period_end * 1000) : row.endDate,
				cancelAtPeriodEnd: subscription.cancel_at_period_end,
				stripeCustomerId: customerId,
				stripeSubscriptionId: subscription.id,
			}
		);

		if (status === SubscriptionStatus.PAST_DUE && !wasPastDue && item) {
			await this.notifications.emit(
				this.dataSource.manager,
				row.businessId,
				NotificationKind.PAYMENT_FAILED,
				{ plan: plan ?? row.planCode },
				{ dedupeKey: `payment-failed:${subscription.id}:${item.current_period_end}` }
			);
		}
	}
}
