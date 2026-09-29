import { BaseEntity } from "@/models/base.entity";
import { Business } from "@/models/businesses/entities/business.entity";
import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";

/**
 * A physical location. Every business gets one at creation, so orders, stock and shifts
 * always have a branch to belong to — multi-branch later is more rows, not a migration.
 */
@Entity("branch")
export class Branch extends BaseEntity {
	@Index("idx_branch_business_id")
	@Column({ name: "business_id", type: "uuid" })
	businessId: string;

	@ManyToOne(() => Business, { onDelete: "CASCADE" })
	@JoinColumn({ name: "business_id" })
	business: Business;

	@Column({ type: "varchar", length: 120 })
	name: string;

	@Column({ type: "varchar", length: 30, nullable: true })
	phone: string | null;

	@Column({ type: "text", nullable: true })
	address: string | null;

	/** The branch a new order lands in when none is chosen. Exactly one per business. */
	@Column({ name: "is_default", type: "boolean", default: false })
	isDefault: boolean;

	@Column({ name: "is_active", type: "boolean", default: true })
	isActive: boolean;
}
