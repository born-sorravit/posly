import { BaseEntity } from "@/models/base.entity";
import { TableSessionStatus } from "@/shared/enums/table.enum";
import { Column, Entity, Index } from "typeorm";

/**
 * A table's open tab. Opening a table creates only this row; the order behind it is created
 * when the first round is accepted, so an opened-and-abandoned table never takes an order
 * number or a slot of the monthly quota.
 */
@Entity("table_session")
@Index("idx_table_session_business_status", ["businessId", "status"])
// One open tab per table: two staff opening the same table at once, one wins.
@Index("uq_table_session_open", ["tableId"], {
	unique: true,
	where: "status = 'OPEN'",
})
export class TableSession extends BaseEntity {
	@Column({ name: "business_id", type: "uuid" })
	businessId: string;

	@Column({ name: "branch_id", type: "uuid" })
	branchId: string;

	@Column({ name: "table_id", type: "uuid" })
	tableId: string;

	@Column({
		type: "enum",
		enum: TableSessionStatus,
		default: TableSessionStatus.OPEN,
	})
	status: TableSessionStatus;

	@Column({ type: "int", nullable: true })
	guests: number | null;

	/** Null when a guest opened the table by ordering from its QR. */
	@Column({ name: "opened_by_member_id", type: "uuid", nullable: true })
	openedByMemberId: string | null;

	@Column({ name: "opened_at", type: "timestamptz" })
	openedAt: Date;

	@Column({ name: "closed_at", type: "timestamptz", nullable: true })
	closedAt: Date | null;

	/** The PENDING_PAYMENT order the tab's rounds go into; null until the first round. */
	@Column({ name: "order_id", type: "uuid", nullable: true })
	orderId: string | null;
}
