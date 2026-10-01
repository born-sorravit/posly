import { BaseEntity } from "@/models/base.entity";
import { OrderItem } from "@/models/orders/entities/order-item.entity";
import { Payment } from "@/models/orders/entities/payment.entity";
import { KitchenStatus, OrderStatus, ServiceType } from "@/shared/enums/order.enum";
import { moneyColumnTransformer, type Satang } from "@/shared/utils/money.util";
import { Column, Entity, Index, OneToMany } from "typeorm";

/**
 * A sale. Everything a receipt shows is stored here or on its items as a **snapshot** — a
 * later price change or product rename must never rewrite a past order.
 */
@Entity("order")
@Index("uq_order_business_number", ["businessId", "number"], { unique: true })
// The idempotency key: a retried or double-tapped checkout returns the first order.
@Index("uq_order_business_client_id", ["businessId", "clientOrderId"], {
	unique: true,
})
@Index("idx_order_business_created", ["businessId", "createdAt"])
export class Order extends BaseEntity {
	@Column({ name: "business_id", type: "uuid" })
	businessId: string;

	@Column({ name: "branch_id", type: "uuid" })
	branchId: string;

	/** The member who rang it up. */
	@Index("idx_order_member_id")
	@Column({ name: "member_id", type: "uuid" })
	memberId: string;

	@Column({ name: "employee_name", type: "varchar", length: 120 })
	employeeName: string;

	/** The customer picked at checkout, if any (plan §22). */
	@Index("idx_order_customer_id")
	@Column({ name: "customer_id", type: "uuid", nullable: true })
	customerId: string | null;

	/** Name at the time of sale, so the receipt reads the same after a rename or delete. */
	@Column({ name: "customer_name", type: "varchar", length: 120, nullable: true })
	customerName: string | null;

	/** Sequential per business (`#000124`), allocated under a row lock on the business. */
	@Column({ type: "int" })
	number: number;

	@Column({ name: "client_order_id", type: "uuid" })
	clientOrderId: string;

	@Column({ type: "enum", enum: OrderStatus })
	status: OrderStatus;

	@Column({ name: "service_type", type: "enum", enum: ServiceType, nullable: true })
	serviceType: ServiceType | null;

	/** What the counter calls this order out as: "โต๊ะ 3", "คิว 12", a name. */
	@Column({ type: "varchar", length: 40, nullable: true })
	label: string | null;

	/** Null when no line goes to the kitchen. */
	@Column({
		name: "kitchen_status",
		type: "enum",
		enum: KitchenStatus,
		nullable: true,
	})
	kitchenStatus: KitchenStatus | null;

	@Column({ name: "kitchen_updated_at", type: "timestamptz", nullable: true })
	kitchenUpdatedAt: Date | null;

	@Column({ type: "bigint", transformer: moneyColumnTransformer })
	subtotal: Satang;

	@Column({ type: "bigint", default: 0, transformer: moneyColumnTransformer })
	discount: Satang;

	@Column({ type: "bigint", default: 0, transformer: moneyColumnTransformer })
	vat: Satang;

	@Column({ type: "bigint", transformer: moneyColumnTransformer })
	total: Satang;

	/** Σ unitCost × quantity at the time of sale, for estimated profit. */
	@Column({
		name: "total_cost",
		type: "bigint",
		default: 0,
		transformer: moneyColumnTransformer,
	})
	totalCost: Satang;

	/**
	 * Ingredient amounts this sale took from stock, by ingredient id — what a refund puts
	 * back, even if the recipe has changed since. Null when nothing was taken.
	 */
	@Column({ name: "ingredient_usage", type: "jsonb", nullable: true })
	ingredientUsage: Record<string, number> | null;

	@Column({ name: "vat_basis_points", type: "int", default: 0 })
	vatBasisPoints: number;

	@Column({ name: "prices_include_vat", type: "boolean", default: true })
	pricesIncludeVat: boolean;

	@Column({ name: "paid_at", type: "timestamptz", nullable: true })
	paidAt: Date | null;

	/** The table tab this order is the bill of; PENDING_PAYMENT until the tab is paid. */
	@Index("idx_order_table_session_id")
	@Column({ name: "table_session_id", type: "uuid", nullable: true })
	tableSessionId: string | null;

	@OneToMany(
		() => OrderItem,
		(item) => item.order,
		{ cascade: true }
	)
	items: OrderItem[];

	@OneToMany(
		() => Payment,
		(payment) => payment.order,
		{ cascade: true }
	)
	payments: Payment[];
}
