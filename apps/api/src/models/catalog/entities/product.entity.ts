import { BaseEntity } from "@/models/base.entity";
import { Category } from "@/models/catalog/entities/category.entity";
import { ModifierGroup } from "@/models/catalog/entities/modifier-group.entity";
import { moneyColumnTransformer, type Satang } from "@/shared/utils/money.util";
import {
	Column,
	Entity,
	Index,
	JoinColumn,
	JoinTable,
	ManyToMany,
	ManyToOne,
} from "typeorm";

@Entity("product")
@Index("idx_product_business_category", ["businessId", "categoryId"])
// Partial: a soft-deleted product must not keep its SKU hostage.
@Index("uq_product_business_sku", ["businessId", "sku"], {
	unique: true,
	where: "sku IS NOT NULL AND deleted_at IS NULL",
})
export class Product extends BaseEntity {
	@Column({ name: "business_id", type: "uuid" })
	businessId: string;

	@Column({ name: "category_id", type: "uuid", nullable: true })
	categoryId: string | null;

	@ManyToOne(() => Category, { onDelete: "SET NULL", nullable: true })
	@JoinColumn({ name: "category_id" })
	category: Category | null;

	@Column({ type: "varchar", length: 120 })
	name: string;

	@Column({ type: "bigint", transformer: moneyColumnTransformer })
	price: Satang;

	/** Unit cost for estimated profit. Null = unknown, counted as zero cost. */
	@Column({ type: "bigint", nullable: true, transformer: moneyColumnTransformer })
	cost: Satang | null;

	@Column({ type: "varchar", length: 40, nullable: true })
	sku: string | null;

	@Column({ type: "varchar", length: 40, nullable: true })
	barcode: string | null;

	/** Storage bucket object path; the public URL is derived from config. */
	@Column({ name: "image_path", type: "varchar", length: 300, nullable: true })
	imagePath: string | null;

	/** Illustration key used when there is no photo (`coffee`, `latte`, `croissant`, …). */
	@Column({ type: "varchar", length: 20, default: "coffee" })
	art: string;

	@Column({ name: "track_stock", type: "boolean", default: false })
	trackStock: boolean;

	/**
	 * Current quantity when `trackStock`. A plain column for the MVP; the phase-2 Inventory
	 * module moves it to a per-branch table with a movement history.
	 */
	@Column({ type: "int", nullable: true })
	stock: number | null;

	@Column({ name: "low_stock_at", type: "int", nullable: true })
	lowStockAt: number | null;

	@Column({ type: "varchar", length: 20, default: "ชิ้น" })
	unit: string;

	@Column({ name: "is_active", type: "boolean", default: true })
	isActive: boolean;

	@ManyToMany(() => ModifierGroup)
	@JoinTable({
		name: "product_modifier_group",
		joinColumn: { name: "product_id", referencedColumnName: "id" },
		inverseJoinColumn: { name: "modifier_group_id", referencedColumnName: "id" },
	})
	modifierGroups: ModifierGroup[];
}
