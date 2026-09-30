import { BaseEntity } from "@/models/base.entity";
import { Ingredient } from "@/models/inventory/entities/ingredient.entity";
import { quantityColumnTransformer } from "@/shared/utils/quantity.util";
import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";

/**
 * One ingredient in a product's recipe, or in a modifier option's (an extra shot is 18 g of
 * beans). Exactly one of `productId` / `modifierOptionId` is set.
 */
@Entity("recipe_line")
@Check(
	"chk_recipe_line_owner",
	`("product_id" IS NULL) <> ("modifier_option_id" IS NULL)`
)
export class RecipeLine extends BaseEntity {
	@Index("idx_recipe_line_business_id")
	@Column({ name: "business_id", type: "uuid" })
	businessId: string;

	@Index("idx_recipe_line_product_id")
	@Column({ name: "product_id", type: "uuid", nullable: true })
	productId: string | null;

	@Index("idx_recipe_line_modifier_option_id")
	@Column({ name: "modifier_option_id", type: "uuid", nullable: true })
	modifierOptionId: string | null;

	@Index("idx_recipe_line_ingredient_id")
	@Column({ name: "ingredient_id", type: "uuid" })
	ingredientId: string;

	@ManyToOne(() => Ingredient, { onDelete: "CASCADE" })
	@JoinColumn({ name: "ingredient_id" })
	ingredient: Ingredient;

	/** In the ingredient's unit, per one of the product (or per choice of the option). */
	@Column({
		type: "numeric",
		precision: 14,
		scale: 3,
		transformer: quantityColumnTransformer,
	})
	quantity: number;

	@Column({ name: "display_order", type: "int", default: 0 })
	displayOrder: number;
}
