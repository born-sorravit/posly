import { BaseEntity } from "@/models/base.entity";
import { moneyColumnTransformer, type Satang } from "@/shared/utils/money.util";
import { quantityColumnTransformer } from "@/shared/utils/quantity.util";
import { Column, Entity, Index } from "typeorm";

/**
 * Something a recipe uses: coffee beans, milk, a cup. Its cost is kept as it is bought
 * (฿500 for 1,000 g) rather than per gram, so no price ever needs a fraction of a satang.
 */
@Entity("ingredient")
@Index("uq_ingredient_business_name", ["businessId", "name"], {
	unique: true,
	where: '"deleted_at" IS NULL',
})
export class Ingredient extends BaseEntity {
	@Index("idx_ingredient_business_id")
	@Column({ name: "business_id", type: "uuid" })
	businessId: string;

	@Column({ type: "varchar", length: 80 })
	name: string;

	/** What recipes measure it in: กรัม, มล., ชิ้น. */
	@Column({ type: "varchar", length: 20 })
	unit: string;

	/** Price paid for `purchaseQty` units. Satang. */
	@Column({
		name: "purchase_price",
		type: "bigint",
		default: 0,
		transformer: moneyColumnTransformer,
	})
	purchasePrice: Satang;

	/** How many `unit`s that price buys, e.g. 1000 (g) for a 1 kg bag. */
	@Column({
		name: "purchase_qty",
		type: "numeric",
		precision: 14,
		scale: 3,
		default: 1,
		transformer: quantityColumnTransformer,
	})
	purchaseQty: number;

	@Column({ name: "track_stock", type: "boolean", default: false })
	trackStock: boolean;

	/** In `unit`s. May go below zero: a sale is never refused over an ingredient. */
	@Column({
		type: "numeric",
		precision: 14,
		scale: 3,
		nullable: true,
		transformer: quantityColumnTransformer,
	})
	stock: number | null;

	@Column({
		name: "low_stock_at",
		type: "numeric",
		precision: 14,
		scale: 3,
		nullable: true,
		transformer: quantityColumnTransformer,
	})
	lowStockAt: number | null;
}
