import { OrderDirection, PaginationDto } from "@/shared/dto/pagination.dto";
import { trimmed } from "@/shared/dto/transform.util";
import { ExpenseCategory } from "@/shared/enums/expense-category.enum";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
	IsDateString,
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	Matches,
	Max,
	MaxLength,
	Min,
} from "class-validator";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateExpenseDto {
	@ApiProperty({ enum: ExpenseCategory })
	@IsEnum(ExpenseCategory)
	category: ExpenseCategory;

	@ApiProperty({ example: 150_000, description: "Satang" })
	@IsInt()
	@Min(1)
	@Max(10_000_000_000)
	amount: number;

	@ApiPropertyOptional({ example: "ค่าไฟเดือนกันยายน" })
	@IsOptional()
	@Transform(trimmed)
	@IsString()
	@MaxLength(200)
	note?: string;

	@ApiProperty({
		example: "2026-09-28",
		description: "The shop-local day it belongs to",
	})
	@Matches(DATE)
	@IsDateString()
	spentOn: string;
}

export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {}

export class QueryExpensesDto extends PaginationDto {
	@ApiPropertyOptional({ example: "2026-09-01", description: "Inclusive" })
	@IsOptional()
	@Matches(DATE)
	from?: string;

	@ApiPropertyOptional({ example: "2026-09-30", description: "Inclusive" })
	@IsOptional()
	@Matches(DATE)
	to?: string;

	@ApiPropertyOptional({ enum: ExpenseCategory })
	@IsOptional()
	@IsEnum(ExpenseCategory)
	category?: ExpenseCategory;

	order: OrderDirection = OrderDirection.DESC;
}

export class ExpenseResponse {
	@ApiProperty() id: string;
	@ApiProperty({ enum: ExpenseCategory }) category: ExpenseCategory;
	@ApiProperty() amount: number;
	@ApiProperty({ nullable: true }) note: string | null;
	@ApiProperty() spentOn: string;
	@ApiProperty() recordedBy: string;
	@ApiProperty() createdAt: Date;
}

export class ExpenseSummaryResponse {
	@ApiProperty({ description: "Sum over the filters, every page" }) total: number;
	@ApiProperty({ description: "Satang per category over the filters" })
	byCategory: Partial<Record<ExpenseCategory, number>>;
}
