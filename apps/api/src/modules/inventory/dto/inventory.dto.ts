import { trimmed } from "@/shared/dto/transform.util";
import { StockAdjustmentType } from "@/modules/catalog/dto/catalog.dto";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
	ArrayMaxSize,
	IsArray,
	IsBoolean,
	IsEnum,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	MaxLength,
	Min,
	MinLength,
	ValidateNested,
} from "class-validator";

const MAX_PRICE = 100_000_000; // ฿1,000,000
const MAX_QTY = 1_000_000_000;
const threeDecimals = { maxDecimalPlaces: 3 };

export class CreateIngredientDto {
	@ApiProperty({ example: "เมล็ดกาแฟ" })
	@Transform(trimmed)
	@IsString()
	@MinLength(1)
	@MaxLength(80)
	name: string;

	@ApiProperty({ example: "กรัม", description: "What recipes measure it in" })
	@Transform(trimmed)
	@IsString()
	@MinLength(1)
	@MaxLength(20)
	unit: string;

	@ApiProperty({
		example: 50_000,
		description: "Satang paid for `purchaseQty` units",
	})
	@IsInt()
	@Min(0)
	@Max(MAX_PRICE)
	purchasePrice: number;

	@ApiProperty({ example: 1000, description: "Units that price buys" })
	@IsNumber(threeDecimals)
	@Min(0.001)
	@Max(MAX_QTY)
	purchaseQty: number;

	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	trackStock?: boolean;

	@ApiPropertyOptional({ nullable: true, description: "Opening stock, in units" })
	@IsOptional()
	@IsNumber(threeDecimals)
	@Min(0)
	@Max(MAX_QTY)
	stock?: number | null;

	@ApiPropertyOptional({ nullable: true })
	@IsOptional()
	@IsNumber(threeDecimals)
	@Min(0)
	@Max(MAX_QTY)
	lowStockAt?: number | null;
}

export class UpdateIngredientDto extends PartialType(CreateIngredientDto) {}

export class IngredientResponse {
	@ApiProperty() id: string;
	@ApiProperty() name: string;
	@ApiProperty() unit: string;
	@ApiProperty({
		type: Number,
		nullable: true,
		description: "Null without products:write",
	})
	purchasePrice: number | null;
	@ApiProperty() purchaseQty: number;
	@ApiProperty({
		type: Number,
		nullable: true,
		description: "Satang per unit, fractional; null without products:write",
	})
	unitCost: number | null;
	@ApiProperty() trackStock: boolean;
	@ApiProperty({ type: Number, nullable: true }) stock: number | null;
	@ApiProperty({ type: Number, nullable: true }) lowStockAt: number | null;
	@ApiProperty({ description: "Products and options whose recipe uses it" })
	usedBy: number;
}

export class AdjustIngredientStockDto {
	@ApiProperty({ enum: StockAdjustmentType })
	@IsEnum(StockAdjustmentType)
	type: StockAdjustmentType;

	@ApiProperty({
		example: 1000,
		description: "Units moved, or the counted total for COUNT",
	})
	@IsNumber(threeDecimals)
	@Min(0)
	@Max(MAX_QTY)
	quantity: number;

	@ApiPropertyOptional({ example: "รับจากซัพพลายเออร์" })
	@IsOptional()
	@Transform(trimmed)
	@IsString()
	@MaxLength(200)
	note?: string;
}

export class RecipeLineInput {
	@ApiProperty()
	@IsUUID()
	ingredientId: string;

	@ApiProperty({ example: 18 })
	@IsNumber(threeDecimals)
	@Min(0.001)
	@Max(MAX_QTY)
	quantity: number;
}

export class SetRecipeDto {
	@ApiProperty({ type: [RecipeLineInput], description: "Empty clears the recipe" })
	@IsArray()
	@ArrayMaxSize(40)
	@ValidateNested({ each: true })
	@Type(() => RecipeLineInput)
	lines: RecipeLineInput[];
}

export class RecipeLineResponse {
	@ApiProperty() ingredientId: string;
	@ApiProperty() name: string;
	@ApiProperty() unit: string;
	@ApiProperty() quantity: number;
	@ApiProperty({ description: "This line's cost in satang, fractional" })
	cost: number;
}

export class RecipeResponse {
	@ApiProperty({ type: [RecipeLineResponse] }) lines: RecipeLineResponse[];
	@ApiProperty({ description: "Whole-satang total, as written to the cost" })
	cost: number;
}
