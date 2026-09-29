import { BaseEntity } from "@/models/base.entity";
import { ModifierGroup } from "@/models/catalog/entities/modifier-group.entity";
import { moneyColumnTransformer, type Satang } from "@/shared/utils/money.util";
import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";

@Entity("modifier_option")
export class ModifierOption extends BaseEntity {
	@Index("idx_modifier_option_group_id")
	@Column({ name: "group_id", type: "uuid" })
	groupId: string;

	@ManyToOne(
		() => ModifierGroup,
		(group) => group.options,
		{ onDelete: "CASCADE" }
	)
	@JoinColumn({ name: "group_id" })
	group: ModifierGroup;

	@Column({ type: "varchar", length: 80 })
	name: string;

	/** Added to the product's price when chosen. Satang. */
	@Column({
		name: "price_delta",
		type: "bigint",
		default: 0,
		transformer: moneyColumnTransformer,
	})
	priceDelta: Satang;

	/** Pre-selected in a SINGLE group. */
	@Column({ name: "is_default", type: "boolean", default: false })
	isDefault: boolean;

	@Column({ name: "display_order", type: "int", default: 0 })
	displayOrder: number;
}
