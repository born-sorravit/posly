import { SubscriptionPlan } from "@/models/subscriptions/entities/subscription-plan.entity";
import { CacheKeys } from "@/shared/cache/cache-keys";
import { CacheService } from "@/shared/cache/cache.service";
import { Subscription } from "@/models/subscriptions/entities/subscription.entity";
import {
	Feature,
	PlanCode,
	SubscriptionStatus,
} from "@/shared/enums/subscription.enum";
import { ForbiddenException, Injectable } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";

export interface Limits {
	orders: number | null;
	members: number | null;
	branches: number | null;
	tables: number | null;
}

export interface Usage {
	ordersThisMonth: number;
	members: number;
	branches: number;
	tables: number;
}

export interface Entitlements {
	/** The plan in force now — Free while a paid plan has lapsed. */
	plan: string;
	planName: string;
	/** The plan on the subscription row, which may differ from `plan` when lapsed. */
	subscribedPlan: string;
	status: SubscriptionStatus;
	endDate: Date | null;
	cancelAtPeriodEnd: boolean;
	/** Paid through Stripe (card, portal) rather than set by hand. */
	billedOnline: boolean;
	features: Feature[];
	limits: Limits;
}

const PLAN_CACHE_MS = 60_000;
/** Billing writes forget it at once (`forgetSubscription`); this only bounds anything else. */
const SUBSCRIPTION_CACHE_SECONDS = 60;

/** The fields entitlements read, as they survive a JSON round trip through the cache. */
type SubscriptionSnapshot = Pick<
	Subscription,
	"planCode" | "status" | "endDate" | "cancelAtPeriodEnd" | "stripeSubscriptionId"
>;
const STRIPE_RENEWAL_GRACE_MS = 48 * 3_600_000;

/**
 * The single answer to "what may this shop do" (plan §25: the backend is the source of
 * truth). Plans are a handful of rows, read once a minute; the subscription is read per call.
 *
 * A subscription only grants its plan while it is ACTIVE or TRIALING and not past its end
 * date. Anything else — cancelled, unpaid, expired, or no row at all — resolves to Free, so
 * a billing hiccup narrows a shop's limits instead of locking it out of its own till.
 */
@Injectable()
export class EntitlementsService {
	private plans: Map<string, SubscriptionPlan> | null = null;
	private plansAt = 0;

	constructor(
		private readonly dataSource: DataSource,
		private readonly cacheService: CacheService
	) {}

	async plansByCode(): Promise<Map<string, SubscriptionPlan>> {
		if (!this.plans || Date.now() - this.plansAt > PLAN_CACHE_MS) {
			const rows = await this.dataSource.getRepository(SubscriptionPlan).find({
				relations: { features: true },
				order: { displayOrder: "ASC" },
			});
			this.plans = new Map(rows.map((p) => [p.code, p]));
			this.plansAt = Date.now();
		}
		return this.plans;
	}

	/** Drop the cached plans — after a plan row changes (scripts, tests). */
	invalidatePlans() {
		this.plans = null;
	}

	async forBusiness(
		businessId: string,
		manager?: EntityManager
	): Promise<Entitlements> {
		const subscription = await this.subscriptionOf(businessId, manager);
		const plans = await this.plansByCode();

		// A Stripe renewal lands by webhook moments after the period ends; the grace keeps a
		// late webhook from dropping a paying shop to Free for those minutes.
		const grace = subscription?.stripeSubscriptionId ? STRIPE_RENEWAL_GRACE_MS : 0;
		const inForce =
			subscription !== null &&
			(subscription.status === SubscriptionStatus.ACTIVE ||
				subscription.status === SubscriptionStatus.TRIALING) &&
			(subscription.endDate === null ||
				subscription.endDate.getTime() + grace > Date.now());
		const plan =
			(inForce ? plans.get(subscription.planCode) : undefined) ??
			plans.get(PlanCode.FREE);
		if (!plan) throw new Error("The FREE plan row is missing");

		return {
			plan: plan.code,
			planName: plan.name,
			subscribedPlan: subscription?.planCode ?? PlanCode.FREE,
			status: subscription?.status ?? SubscriptionStatus.ACTIVE,
			endDate: subscription?.endDate ?? null,
			cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
			billedOnline: Boolean(subscription?.stripeSubscriptionId),
			features: (plan.features ?? []).filter((f) => f.enabled).map((f) => f.feature),
			limits: {
				orders: plan.orderLimit,
				members: plan.memberLimit,
				branches: plan.branchLimit,
				tables: plan.tableLimit,
			},
		};
	}

	/**
	 * The shop's subscription row. Read fresh inside a transaction (the checkout's quota check
	 * must see the row as the transaction does); otherwise cached, since every feature-gated
	 * request asks and the row changes only through billing.
	 */
	private async subscriptionOf(
		businessId: string,
		manager?: EntityManager
	): Promise<SubscriptionSnapshot | null> {
		const read = async (): Promise<SubscriptionSnapshot | null> => {
			const row = await (manager ?? this.dataSource.manager)
				.getRepository(Subscription)
				.findOne({ where: { businessId } });
			return row
				? {
						planCode: row.planCode,
						status: row.status,
						endDate: row.endDate,
						cancelAtPeriodEnd: row.cancelAtPeriodEnd,
						stripeSubscriptionId: row.stripeSubscriptionId,
					}
				: null;
		};
		if (manager) return read();

		const cached = await this.cacheService.remember(
			CacheKeys.subscription(businessId),
			read,
			SUBSCRIPTION_CACHE_SECONDS
		);
		// Dates come back from the cache as strings.
		return (
			cached && {
				...cached,
				endDate: cached.endDate ? new Date(cached.endDate) : null,
			}
		);
	}

	/** Call after writing a shop's subscription row, so its new plan applies at once. */
	forgetSubscription(businessId: string): Promise<void> {
		return this.cacheService.forget(CacheKeys.subscription(businessId));
	}

	async hasFeature(businessId: string, feature: Feature): Promise<boolean> {
		return (await this.forBusiness(businessId)).features.includes(feature);
	}

	/**
	 * Orders counted against the monthly quota: every order created this calendar month in
	 * the shop's own timezone, refunded and cancelled ones included — a refund returns the
	 * money, not the ring-up.
	 */
	async ordersThisMonth(
		manager: EntityManager,
		businessId: string,
		timezone: string
	): Promise<number> {
		const [row] = (await manager.query(
			`SELECT COUNT(*)::int AS n FROM "order"
			 WHERE business_id = $1 AND deleted_at IS NULL
			   AND created_at >= (date_trunc('month', now() AT TIME ZONE $2) AT TIME ZONE $2)`,
			[businessId, timezone]
		)) as { n: number }[];
		return row.n;
	}

	/** Staff seats taken: everyone but the owner who is active or holds a live invitation. */
	async membersInUse(manager: EntityManager, businessId: string): Promise<number> {
		const [row] = (await manager.query(
			`SELECT COUNT(*)::int AS n FROM business_member
			 WHERE business_id = $1 AND deleted_at IS NULL AND role <> 'OWNER'
			   AND status IN ('ACTIVE', 'INVITED')`,
			[businessId]
		)) as { n: number }[];
		return row.n;
	}

	async branchesInUse(manager: EntityManager, businessId: string): Promise<number> {
		const [row] = (await manager.query(
			`SELECT COUNT(*)::int AS n FROM branch WHERE business_id = $1 AND deleted_at IS NULL`,
			[businessId]
		)) as { n: number }[];
		return row.n;
	}

	async usage(businessId: string, timezone: string): Promise<Usage> {
		const manager = this.dataSource.manager;
		const [ordersThisMonth, members, branches, tables] = await Promise.all([
			this.ordersThisMonth(manager, businessId, timezone),
			this.membersInUse(manager, businessId),
			this.branchesInUse(manager, businessId),
			this.tablesInUse(manager, businessId),
		]);
		return { ordersThisMonth, members, branches, tables };
	}

	/**
	 * Refuses a sale over the monthly quota. Call inside the checkout transaction *after*
	 * the business row is locked (the order-number increment), so two tills cannot both take
	 * the last order of the month.
	 */
	async assertOrderQuota(
		manager: EntityManager,
		businessId: string,
		timezone: string
	): Promise<{ used: number; limit: number } | null> {
		const { limits } = await this.forBusiness(businessId, manager);
		if (limits.orders === null) return null;
		const used = await this.ordersThisMonth(manager, businessId, timezone);
		if (used >= limits.orders) {
			throw new ForbiddenException(
				`Monthly order limit of ${limits.orders} reached`
			);
		}
		// What the caller's order will make it, for the "nearly at your limit" warning.
		return { used: used + 1, limit: limits.orders };
	}

	async tablesInUse(manager: EntityManager, businessId: string): Promise<number> {
		const [row] = (await manager.query(
			`SELECT COUNT(*)::int AS n FROM dining_table WHERE business_id = $1 AND deleted_at IS NULL`,
			[businessId]
		)) as { n: number }[];
		return row.n;
	}

	/**
	 * Refuses a table past the plan's count. A shop over it after a downgrade keeps its
	 * tables; it only cannot add more.
	 */
	async assertTableSlot(manager: EntityManager, businessId: string): Promise<void> {
		const { limits } = await this.forBusiness(businessId, manager);
		if (limits.tables === null) return;
		if ((await this.tablesInUse(manager, businessId)) >= limits.tables) {
			throw new ForbiddenException(`Plan allows up to ${limits.tables} tables`);
		}
	}

	/** Refuses a new or re-enabled staff member past the plan's seat count. */
	async assertMemberSeat(manager: EntityManager, businessId: string): Promise<void> {
		const { limits } = await this.forBusiness(businessId, manager);
		if (limits.members === null) return;
		if ((await this.membersInUse(manager, businessId)) >= limits.members) {
			throw new ForbiddenException(`Plan allows up to ${limits.members} employees`);
		}
	}

	async assertBranchSlot(manager: EntityManager, businessId: string): Promise<void> {
		const { limits } = await this.forBusiness(businessId, manager);
		if (limits.branches === null) return;
		if ((await this.branchesInUse(manager, businessId)) >= limits.branches) {
			throw new ForbiddenException(`Plan allows up to ${limits.branches} branches`);
		}
	}
}
