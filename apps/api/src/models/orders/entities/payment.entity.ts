import { BaseEntity } from "@/models/base.entity";
import { Order } from "@/models/orders/entities/order.entity";
import { PaymentMethod, PaymentStatus } from "@/shared/enums/order.enum";
import { moneyColumnTransformer, type Satang } from "@/shared/utils/money.util";
import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";

@Entity("payment")
@Index("idx_payment_business_created", ["businessId", "createdAt"])
export class Payment extends BaseEntity {
	@Column({ name: "business_id", type: "uuid" })
	businessId: string;

	@Index("idx_payment_order_id")
	@Column({ name: "order_id", type: "uuid" })
	orderId: string;

	@ManyToOne(
		() => Order,
		(order) => order.payments,
		{ onDelete: "CASCADE" }
	)
	@JoinColumn({ name: "order_id" })
	order: Order;

	@Column({ type: "enum", enum: PaymentMethod })
	method: PaymentMethod;

	@Column({ type: "enum", enum: PaymentStatus })
	status: PaymentStatus;

	@Column({ type: "bigint", transformer: moneyColumnTransformer })
	amount: Satang;

	/** Cash handed over. Null for non-cash. */
	@Column({ type: "bigint", nullable: true, transformer: moneyColumnTransformer })
	received: Satang | null;

	@Column({
		name: "change_due",
		type: "bigint",
		nullable: true,
		transformer: moneyColumnTransformer,
	})
	change: Satang | null;

	/** Gateway reference once PromptPay is verified automatically. */
	@Column({ type: "varchar", length: 120, nullable: true })
	reference: string | null;
}
