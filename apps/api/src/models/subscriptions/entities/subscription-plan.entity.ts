import { PlanFeature } from "@/models/subscriptions/entities/plan-feature.entity";
import { moneyColumnTransformer } from "@/shared/utils/money.util";
import {
	Column,
	CreateDateColumn,
	Entity,
	OneToMany,
	PrimaryColumn,
	UpdateDateColumn,
} from "typeorm";

/**
 * A plan's price, limits and features (plan §25). Stored, not coded: prices are placeholders
 * and the plan says they must change without a release.
 *
 * A null limit means unlimited. `memberLimit` counts staff — everyone but the owner.
 */
export interface PlanHighlight {
	label: string;
	soon: boolean;
}

@Entity("subscription_plan")
export class SubscriptionPlan {
	@PrimaryColumn({ type: "varchar", length: 20 })
	code: string;

	@Column({ type: "varchar", length: 60 })
	name: string;

	@Column({
		name: "monthly_price",
		type: "bigint",
		transformer: moneyColumnTransformer,
	})
	monthlyPrice: number;

	@Column({ name: "order_limit", type: "int", nullable: true })
	orderLimit: number | null;

	@Column({ name: "member_limit", type: "int", nullable: true })
	memberLimit: number | null;

	@Column({ name: "branch_limit", type: "int", nullable: true })
	branchLimit: number | null;

	@Column({ name: "table_limit", type: "int", nullable: true })
	tableLimit: number | null;

	/**
	 * Display lines for the pricing card, in the order shown. `soon` marks a promised
	 * feature that has not shipped, so the card never claims it works today.
	 */
	@Column({ type: "jsonb", default: [] })
	highlights: PlanHighlight[];

	@Column({ name: "display_order", type: "int", default: 0 })
	displayOrder: number;

	@Column({ name: "is_public", type: "boolean", default: true })
	isPublic: boolean;

	@OneToMany(
		() => PlanFeature,
		(f) => f.plan,
		{ cascade: true }
	)
	features: PlanFeature[];

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt: Date;
}
