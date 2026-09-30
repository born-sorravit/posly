import { BaseEntity } from "@/models/base.entity";
import { OrderItem } from "@/models/orders/entities/order-item.entity";
import { moneyColumnTransformer, type Satang } from "@/shared/utils/money.util";
import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";

/** A snapshot of one chosen option — names and deltas as they were when sold. */
@Entity("order_item_modifier")
export class OrderItemModifier extends BaseEntity {
	@Index("idx_order_item_modifier_item_id")
	@Column({ name: "order_item_id", type: "uuid" })
	orderItemId: string;

	@ManyToOne(
		() => OrderItem,
		(item) => item.modifiers,
		{ onDelete: "CASCADE" }
	)
	@JoinColumn({ name: "order_item_id" })
	item: OrderItem;

	@Column({ name: "option_id", type: "uuid", nullable: true })
	optionId: string | null;

	@Column({ name: "group_name", type: "varchar", length: 80 })
	groupName: string;

	@Column({ name: "option_name", type: "varchar", length: 80 })
	optionName: string;

	@Column({
		name: "price_delta",
		type: "bigint",
		default: 0,
		transformer: moneyColumnTransformer,
	})
	priceDelta: Satang;

	@Column({
		name: "cost_delta",
		type: "bigint",
		default: 0,
		transformer: moneyColumnTransformer,
	})
	costDelta: Satang;
}
