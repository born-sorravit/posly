import { BaseEntity } from "@/models/base.entity";
import { TableRequestStatus } from "@/shared/enums/table.enum";
import { Column, Entity, Index } from "typeorm";

/** One line as a guest picked it: no prices, those are read when staff accept it. */
export interface TableRequestLine {
	productId: string;
	quantity: number;
	modifierOptionIds: string[];
	note: string | null;
}

/**
 * A round a guest sent from the table's QR. It belongs to the tab that was open when it was
 * sent, never to the table: a request left pending by one party cannot land on the next
 * party's bill.
 */
@Entity("table_request")
@Index("uq_table_request_client_id", ["sessionId", "clientRequestId"], {
	unique: true,
})
@Index("idx_table_request_session_status", ["sessionId", "status"])
export class TableRequest extends BaseEntity {
	@Column({ name: "business_id", type: "uuid" })
	businessId: string;

	@Column({ name: "branch_id", type: "uuid" })
	branchId: string;

	@Column({ name: "session_id", type: "uuid" })
	sessionId: string;

	@Column({ name: "client_request_id", type: "uuid" })
	clientRequestId: string;

	@Column({ type: "jsonb" })
	items: TableRequestLine[];

	@Column({
		type: "enum",
		enum: TableRequestStatus,
		default: TableRequestStatus.PENDING,
	})
	status: TableRequestStatus;

	@Column({ name: "handled_by_member_id", type: "uuid", nullable: true })
	handledByMemberId: string | null;

	@Column({ name: "handled_at", type: "timestamptz", nullable: true })
	handledAt: Date | null;
}
