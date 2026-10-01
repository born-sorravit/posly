import { BaseEntity } from "@/models/base.entity";
import { Column, Entity, Index } from "typeorm";

/**
 * A table in a branch. Its QR carries `qrToken`, which identifies the table to guests
 * without a login; rotating the token retires every printed copy of the old QR.
 */
@Entity("dining_table")
@Index("idx_dining_table_business_branch", ["businessId", "branchId"])
@Index("uq_dining_table_name", ["branchId", "name"], {
	unique: true,
	where: "deleted_at IS NULL",
})
export class DiningTable extends BaseEntity {
	@Column({ name: "business_id", type: "uuid" })
	businessId: string;

	@Column({ name: "branch_id", type: "uuid" })
	branchId: string;

	@Column({ type: "varchar", length: 40 })
	name: string;

	@Column({ type: "varchar", length: 40, nullable: true })
	zone: string | null;

	/** How many it seats, if the shop says; a guide for staff, never a limit. */
	@Column({ type: "int", nullable: true })
	seats: number | null;

	@Column({ name: "display_order", type: "int", default: 0 })
	displayOrder: number;

	@Column({ name: "is_active", type: "boolean", default: true })
	isActive: boolean;

	@Index("uq_dining_table_qr_token", { unique: true })
	@Column({ name: "qr_token", type: "varchar", length: 64 })
	qrToken: string;
}
