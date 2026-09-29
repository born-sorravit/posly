import { trimmed } from "@/shared/dto/transform.util";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
	IsBoolean,
	IsOptional,
	IsString,
	MaxLength,
	MinLength,
} from "class-validator";

export class CreateBranchDto {
	@ApiProperty({ example: "สาขาสยามสแควร์" })
	@IsString()
	@MinLength(1)
	@MaxLength(120)
	@Transform(trimmed)
	name: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(30)
	phone?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(500)
	address?: string;
}

export class UpdateBranchDto extends PartialType(CreateBranchDto) {
	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	isActive?: boolean;
}

export class BranchResponse {
	@ApiProperty() id: string;
	@ApiProperty() name: string;
	@ApiProperty({ nullable: true }) phone: string | null;
	@ApiProperty({ nullable: true }) address: string | null;
	@ApiProperty() isDefault: boolean;
	@ApiProperty() isActive: boolean;
}
