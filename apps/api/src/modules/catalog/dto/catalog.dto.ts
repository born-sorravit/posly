import { PaginationDto } from "@/shared/dto/pagination.dto";
import { trimmed } from "@/shared/dto/transform.util";
import { ModifierSelection } from "@/shared/enums/order.enum";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsBoolean,
	IsEnum,
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	MaxLength,
	Min,
	MinLength,
	ValidateNested,
} from "class-validator";

/** Satang, not baht: every amount on the wire is an integer minor unit. */
const MAX_PRICE = 100_000_000; // ฿1,000,000

export const PRODUCT_ARTS = [
	"coffee",
	"latte",
	"matcha",
	"tea",
	"chocolate",
	"croissant",
	"cake",
	"brownie",
	"cookie",
	"juice",
	"bottle",
	"rice",
	"noodle",
	"soup",
	"salad",
	"bread",
	"snack",
	"egg",
	"milk",
	"household",
	"service",
	"package",
] as const;

export class CreateCategoryDto {
	@ApiProperty({ example: "กาแฟ" })
	@IsString()
	@MinLength(1)
	@MaxLength(80)
	@Transform(trimmed)
	name: string;

	@ApiPropertyOptional({ example: "coffee" })
	@IsOptional()
	@IsString()
	@MaxLength(40)
	icon?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	isActive?: boolean;

	@ApiPropertyOptional({
		description: "Items appear on the kitchen screen; default true",
	})
	@IsOptional()
	@IsBoolean()
	sendToKitchen?: boolean;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

export class ReorderCategoriesDto {
	@ApiProperty({
		type: [String],
		description: "Every category id, in the new order",
	})
	@IsArray()
	@ArrayMaxSize(200)
	@IsUUID("4", { each: true })
	ids: string[];
}

export class CategoryResponse {
	@ApiProperty() id: string;
	@ApiProperty() name: string;
	@ApiProperty() icon: string;
	@ApiProperty() displayOrder: number;
	@ApiProperty() isActive: boolean;
	@ApiProperty() sendToKitchen: boolean;
	@ApiProperty() productCount: number;
}

export class ModifierOptionInput {
	@ApiPropertyOptional({
		description: "An existing option to keep (and update); omit for a new one",
	})
	@IsOptional()
	@IsUUID()
	id?: string;

	@ApiProperty({ example: "L" })
	@Transform(trimmed)
	@IsString()
	@MinLength(1)
	@MaxLength(80)
	name: string;

	@ApiProperty({ description: "Satang added to the price", example: 2000 })
	@IsInt()
	@Min(0)
	@Max(MAX_PRICE)
	priceDelta: number;

	@ApiPropertyOptional({ description: "Satang added to the cost", example: 800 })
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(MAX_PRICE)
	costDelta?: number;

	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	isDefault?: boolean;
}

export class CreateModifierGroupDto {
	@ApiProperty({ example: "ขนาด" })
	@Transform(trimmed)
	@IsString()
	@MinLength(1)
	@MaxLength(80)
	name: string;

	@ApiProperty({ enum: ModifierSelection })
	@IsEnum(ModifierSelection)
	selection: ModifierSelection;

	@ApiProperty()
	@IsBoolean()
	required: boolean;

	@ApiProperty({ type: [ModifierOptionInput] })
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(30)
	@ValidateNested({ each: true })
	@Type(() => ModifierOptionInput)
	options: ModifierOptionInput[];
}

export class ModifierOptionResponse {
	@ApiProperty() id: string;
	@ApiProperty() name: string;
	@ApiProperty() priceDelta: number;
	@ApiProperty({
		type: Number,
		nullable: true,
		description: "Null for members who cannot edit products",
	})
	costDelta: number | null;
	@ApiPropertyOptional({
		description: "The cost comes from its recipe (list endpoint only)",
	})
	costFromRecipe?: boolean;
	@ApiProperty() isDefault: boolean;
}

export class ModifierGroupResponse {
	@ApiProperty() id: string;
	@ApiProperty() name: string;
	@ApiProperty({ enum: ModifierSelection }) selection: ModifierSelection;
	@ApiProperty() required: boolean;
	@ApiProperty({ type: [ModifierOptionResponse] }) options: ModifierOptionResponse[];
	@ApiProperty({ nullable: true }) defaultOptionId: string | null;
	@ApiPropertyOptional({
		description: "Products using this group (list endpoint only)",
	})
	productCount?: number;
}

export class CreateProductDto {
	@ApiProperty({ example: "Latte" })
	@IsString()
	@MinLength(1)
	@MaxLength(120)
	@Transform(trimmed)
	name: string;

	@ApiPropertyOptional({ nullable: true })
	@IsOptional()
	@IsUUID()
	categoryId?: string | null;

	@ApiProperty({ description: "Satang", example: 7000 })
	@IsInt()
	@Min(0)
	@Max(MAX_PRICE)
	price: number;

	@ApiPropertyOptional({ description: "Satang", nullable: true })
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(MAX_PRICE)
	cost?: number | null;

	@ApiPropertyOptional({ nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(40)
	sku?: string | null;

	@ApiPropertyOptional({ nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(40)
	barcode?: string | null;

	@ApiPropertyOptional({ nullable: true, description: "Path from POST /uploads" })
	@IsOptional()
	@IsString()
	@MaxLength(300)
	imagePath?: string | null;

	@ApiPropertyOptional({ enum: PRODUCT_ARTS })
	@IsOptional()
	@IsIn(PRODUCT_ARTS)
	art?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	trackStock?: boolean;

	@ApiPropertyOptional({ nullable: true })
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(1_000_000)
	stock?: number | null;

	@ApiPropertyOptional({ nullable: true })
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(1_000_000)
	lowStockAt?: number | null;

	@ApiPropertyOptional({ example: "แก้ว" })
	@IsOptional()
	@Transform(trimmed)
	@IsString()
	@MinLength(1)
	@MaxLength(20)
	unit?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	isActive?: boolean;

	@ApiPropertyOptional({ type: [String] })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(20)
	@IsUUID("4", { each: true })
	modifierGroupIds?: string[];
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class ProductResponse {
	@ApiProperty() id: string;
	@ApiProperty() name: string;
	@ApiProperty({ nullable: true }) categoryId: string | null;
	@ApiProperty() price: number;
	@ApiProperty({
		nullable: true,
		description: "Null unless the caller has products:write",
	})
	cost: number | null;
	@ApiProperty({ nullable: true }) sku: string | null;
	@ApiProperty({ nullable: true }) barcode: string | null;
	@ApiProperty() art: string;
	@ApiProperty({ nullable: true }) imageUrl: string | null;
	@ApiProperty({ nullable: true }) imagePath: string | null;
	@ApiProperty() trackStock: boolean;
	@ApiProperty({ nullable: true }) stock: number | null;
	@ApiProperty({ nullable: true }) lowStockAt: number | null;
	@ApiProperty() unit: string;
	@ApiProperty() isActive: boolean;
	@ApiProperty({ type: [ModifierGroupResponse] })
	modifierGroups: ModifierGroupResponse[];
}

export enum StockAdjustmentType {
	/** Goods received: adds `quantity`. */
	IN = "IN",
	/** Written off — broken, expired, used in the shop: removes `quantity`. */
	OUT = "OUT",
	/** A shelf count: `quantity` is what is actually there now. */
	COUNT = "COUNT",
}

export class AdjustStockDto {
	@ApiProperty({ enum: StockAdjustmentType })
	@IsEnum(StockAdjustmentType)
	type: StockAdjustmentType;

	@ApiProperty({
		example: 12,
		description: "Units moved, or the counted total for COUNT",
	})
	@IsInt()
	@Min(0)
	@Max(1_000_000)
	quantity: number;

	@ApiPropertyOptional({
		example: 2400,
		description:
			"IN only: satang paid per unit. Moves the product's cost to the weighted average, unless its recipe sets the cost",
	})
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(MAX_PRICE)
	unitCost?: number;

	@ApiPropertyOptional({ example: "รับจากซัพพลายเออร์" })
	@IsOptional()
	@Transform(trimmed)
	@IsString()
	@MaxLength(200)
	note?: string;
}

export class QueryStockAdjustmentsDto extends PaginationDto {
	@ApiPropertyOptional({ description: "Only this product's history" })
	@IsOptional()
	@IsUUID()
	productId?: string;

	@ApiPropertyOptional({ enum: StockAdjustmentType })
	@IsOptional()
	@IsEnum(StockAdjustmentType)
	type?: StockAdjustmentType;
}

export class StockAdjustmentResponse {
	@ApiProperty() id: string;
	@ApiProperty() createdAt: Date;
	@ApiProperty() productId: string;
	@ApiProperty({ description: "Current name; a deleted product keeps its last one" })
	productName: string;
	@ApiProperty() productUnit: string;
	@ApiProperty() art: string;
	@ApiProperty() productDeleted: boolean;
	@ApiProperty({ enum: StockAdjustmentType }) type: StockAdjustmentType;
	@ApiProperty({ description: "As entered: units moved, or the counted total" })
	quantity: number;
	@ApiProperty() before: number;
	@ApiProperty() after: number;
	@ApiProperty({ description: "after - before" }) change: number;
	@ApiProperty({ nullable: true }) note: string | null;
	@ApiProperty() actorName: string;
	@ApiProperty({
		type: Number,
		nullable: true,
		description:
			"Satang paid per unit on a receipt; null when none was entered or for members who cannot edit products",
	})
	unitCost: number | null;
	@ApiProperty({
		type: Number,
		nullable: true,
		description: "The product's cost before this receipt",
	})
	costBefore: number | null;
	@ApiProperty({
		type: Number,
		nullable: true,
		description: "Its cost after; equal to costBefore when a recipe sets the cost",
	})
	costAfter: number | null;
}
