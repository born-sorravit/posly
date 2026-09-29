import { BaseEntity } from "@/models/base.entity";
import { Column, Entity, Index } from "typeorm";

/**
 * A shop's customer (plan §22), attached to orders at checkout. Totals — orders, spending,
 * last visit — are read from those orders, never stored here, so a refund corrects them.
 *
 * Phone is the natural key at a Thai counter ("เบอร์อะไรคะ"), unique per shop when given.
 */
@Entity("customer")
@Index("uq_customer_phone", ["businessId", "phone"], {
	unique: true,
	where: "phone IS NOT NULL AND deleted_at IS NULL",
})
export class Customer extends BaseEntity {
	@Index("idx_customer_business_id")
	@Column({ name: "business_id", type: "uuid" })
	businessId: string;

	@Column({ type: "varchar", length: 120 })
	name: string;

	@Column({ type: "varchar", length: 20, nullable: true })
	phone: string | null;

	@Column({ type: "varchar", length: 255, nullable: true })
	email: string | null;

	@Column({ type: "varchar", length: 300, nullable: true })
	note: string | null;
}
