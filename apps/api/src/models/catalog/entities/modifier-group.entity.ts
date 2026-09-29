import { BaseEntity } from "@/models/base.entity";
import { ModifierOption } from "@/models/catalog/entities/modifier-option.entity";
import { ModifierSelection } from "@/shared/enums/order.enum";
import { Column, Entity, Index, OneToMany } from "typeorm";

/**
 * A reusable choice ("Size", "Sweetness"), owned by the business and attached to many
 * products — every drink shares one Size group rather than each carrying its own copy.
 */
@Entity("modifier_group")
@Index("idx_modifier_group_business_id", ["businessId"])
export class ModifierGroup extends BaseEntity {
	@Column({ name: "business_id", type: "uuid" })
	businessId: string;

	@Column({ type: "varchar", length: 80 })
	name: string;

	@Column({
		type: "enum",
		enum: ModifierSelection,
		default: ModifierSelection.SINGLE,
	})
	selection: ModifierSelection;

	@Column({ type: "boolean", default: false })
	required: boolean;

	@Column({ name: "display_order", type: "int", default: 0 })
	displayOrder: number;

	@OneToMany(
		() => ModifierOption,
		(option) => option.group,
		{ cascade: true }
	)
	options: ModifierOption[];
}
