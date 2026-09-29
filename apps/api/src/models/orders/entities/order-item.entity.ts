import { BaseEntity } from "@/models/base.entity";
import { Order } from "@/models/orders/entities/order.entity";
import { OrderItemModifier } from "@/models/orders/entities/order-item-modifier.entity";
import { moneyColumnTransformer, type Satang } from "@/shared/utils/money.util";
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from "typeorm";

@Entity("order_item")
export class OrderItem extends BaseEntity {
	@Index("idx_order_item_order_id")
	@Column({ name: "order_id", type: "uuid" })
	orderId: string;

	@ManyToOne(
		() => Order,
		(order) => order.items,
		{ onDelete: "CASCADE" }
	)
	@JoinColumn({ name: "order_id" })
	order: Order;

	/** Kept for reporting; nullable because the product may later be deleted. */
	@Index("idx_order_item_product_id")
	@Column({ name: "product_id", type: "uuid", nullable: true })
	productId: string | null;

	@Column({ type: "varchar", length: 120 })
	name: string;

	@Column({ type: "varchar", length: 20, default: "coffee" })
	art: string;

	@Column({ type: "int" })
	quantity: number;

	/** Product price plus modifier deltas, per unit. */
	@Column({
		name: "unit_price",
		type: "bigint",
		transformer: moneyColumnTransformer,
	})
	unitPrice: Satang;

	@Column({
		name: "unit_cost",
		type: "bigint",
		default: 0,
		transformer: moneyColumnTransformer,
	})
	unitCost: Satang;

	@Column({
		name: "line_total",
		type: "bigint",
		transformer: moneyColumnTransformer,
	})
	lineTotal: Satang;

	@Column({ type: "varchar", length: 200, nullable: true })
	note: string | null;

	/** Whether this line is cooked — the category's setting when it was sold. */
	@Column({ name: "to_kitchen", type: "boolean", default: false })
	toKitchen: boolean;

	/** Ticked off on the kitchen screen. */
	@Column({ name: "prepared_at", type: "timestamptz", nullable: true })
	preparedAt: Date | null;

	@OneToMany(
		() => OrderItemModifier,
		(m) => m.item,
		{ cascade: true }
	)
	modifiers: OrderItemModifier[];
}
