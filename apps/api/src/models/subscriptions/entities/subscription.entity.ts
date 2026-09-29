import { BaseEntity } from "@/models/base.entity";
import { SubscriptionPlan } from "@/models/subscriptions/entities/subscription-plan.entity";
import { SubscriptionStatus } from "@/shared/enums/subscription.enum";
import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";

/**
 * A business's current plan (plan §26). One row per business; a change of plan updates it.
 *
 * Entitlements are resolved from it at read time: a lapsed or unpaid subscription gives
 * Free limits — never a locked shop. `endDate` null means open-ended (no billing yet).
 */
@Entity("subscription")
@Index("uq_subscription_business", ["businessId"], {
	unique: true,
	where: "deleted_at IS NULL",
})
@Index("uq_subscription_stripe_subscription", ["stripeSubscriptionId"], {
	unique: true,
	where: "stripe_subscription_id IS NOT NULL",
})
export class Subscription extends BaseEntity {
	@Column({ name: "business_id", type: "uuid" })
	businessId: string;

	@Column({ name: "plan_code", type: "varchar", length: 20 })
	planCode: string;

	@ManyToOne(() => SubscriptionPlan)
	@JoinColumn({ name: "plan_code" })
	plan: SubscriptionPlan;

	@Column({
		type: "enum",
		enum: SubscriptionStatus,
		default: SubscriptionStatus.ACTIVE,
	})
	status: SubscriptionStatus;

	@Column({ name: "start_date", type: "timestamptz" })
	startDate: Date;

	@Column({ name: "end_date", type: "timestamptz", nullable: true })
	endDate: Date | null;

	@Column({ name: "cancel_at_period_end", type: "boolean", default: false })
	cancelAtPeriodEnd: boolean;

	/** Set once the shop first goes to Stripe checkout; reused for every later payment. */
	@Column({
		name: "stripe_customer_id",
		type: "varchar",
		length: 64,
		nullable: true,
	})
	stripeCustomerId: string | null;

	/** The live Stripe subscription billing this row; null for Free or a manually set plan. */
	@Column({
		name: "stripe_subscription_id",
		type: "varchar",
		length: 64,
		nullable: true,
	})
	stripeSubscriptionId: string | null;
}
