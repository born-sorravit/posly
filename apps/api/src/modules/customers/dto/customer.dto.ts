import { PaginationDto } from "@/shared/dto/pagination.dto";
import { toTrimmedString, trimmed } from "@/shared/dto/transform.util";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
	IsEmail,
	IsOptional,
	IsString,
	Matches,
	MaxLength,
	MinLength,
} from "class-validator";

/** Digits only, so "081-234-5678" and "0812345678" are the same customer. */
const digits = ({ value }: { value: unknown }) =>
	typeof value === "string" ? value.replace(/\D/g, "") || null : value;

export class CreateCustomerDto {
	@ApiProperty({ example: "คุณเอ" })
	@Transform(trimmed)
	@IsString()
	@MinLength(1)
	@MaxLength(120)
	name: string;

	@ApiPropertyOptional({ example: "0812345678" })
	@IsOptional()
	@Transform(digits)
	@Matches(/^0\d{8,9}$/, { message: "phone must be a Thai number" })
	phone?: string | null;

	@ApiPropertyOptional()
	@IsOptional()
	@Transform(trimmed)
	@IsEmail()
	@MaxLength(255)
	email?: string | null;

	@ApiPropertyOptional()
	@IsOptional()
	@Transform(trimmed)
	@IsString()
	@MaxLength(300)
	note?: string | null;
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}

export class QueryCustomersDto extends PaginationDto {
	@ApiPropertyOptional({ description: "Name, phone digits or email" })
	@IsOptional()
	@Transform(toTrimmedString)
	@IsString()
	@MaxLength(120)
	search?: string;
}

export class CustomerResponse {
	@ApiProperty() id: string;
	@ApiProperty() name: string;
	@ApiProperty({ nullable: true }) phone: string | null;
	@ApiProperty({ nullable: true }) email: string | null;
	@ApiProperty({ nullable: true }) note: string | null;
	@ApiProperty({ description: "Paid orders" }) totalOrders: number;
	@ApiProperty({ description: "Satang across paid orders" }) totalSpending: number;
	@ApiProperty({ nullable: true }) lastVisitAt: string | null;
	@ApiProperty() createdAt: Date;
}
