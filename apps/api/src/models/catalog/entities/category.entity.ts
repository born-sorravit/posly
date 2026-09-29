import { BaseEntity } from "@/models/base.entity";
import { Column, Entity, Index } from "typeorm";

@Entity("category")
@Index("idx_category_business_order", ["businessId", "displayOrder"])
export class Category extends BaseEntity {
	@Column({ name: "business_id", type: "uuid" })
	businessId: string;

	@Column({ type: "varchar", length: 80 })
	name: string;

	/** A Lucide icon key the UI maps to a glyph (`coffee`, `croissant`, …). */
	@Column({ type: "varchar", length: 40, default: "package" })
	icon: string;

	/** POS chips are sorted by this, ascending. */
	@Column({ name: "display_order", type: "int", default: 0 })
	displayOrder: number;

	/** Items in this category appear on the kitchen screen (off for bottled drinks, retail). */
	@Column({ name: "send_to_kitchen", type: "boolean", default: true })
	sendToKitchen: boolean;

	@Column({ name: "is_active", type: "boolean", default: true })
	isActive: boolean;
}
