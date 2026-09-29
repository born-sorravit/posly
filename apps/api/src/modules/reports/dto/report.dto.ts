import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional } from "class-validator";

export class ReportQueryDto {
	@ApiPropertyOptional({
		enum: ["today", "yesterday", "7d", "30d"],
		default: "today",
	})
	@IsOptional()
	@IsIn(["today", "yesterday", "7d", "30d"])
	range: "today" | "yesterday" | "7d" | "30d" = "today";
}
