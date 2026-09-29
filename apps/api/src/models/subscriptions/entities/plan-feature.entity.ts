import { SubscriptionPlan } from "@/models/subscriptions/entities/subscription-plan.entity";
import { Feature } from "@/shared/enums/subscription.enum";
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";

/** One feature a plan unlocks (plan §26 `SubscriptionFeature`). */
@Entity("plan_feature")
export class PlanFeature {
	@PrimaryColumn({ name: "plan_code", type: "varchar", length: 20 })
	planCode: string;

	@PrimaryColumn({ type: "varchar", length: 40 })
	feature: Feature;

	@ManyToOne(
		() => SubscriptionPlan,
		(p) => p.features,
		{ onDelete: "CASCADE" }
	)
	@JoinColumn({ name: "plan_code" })
	plan: SubscriptionPlan;

	@Column({ type: "boolean", default: true })
	enabled: boolean;
}
