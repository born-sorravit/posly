import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, Matches } from "class-validator";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class ReportQueryDto {
	@ApiPropertyOptional({
		enum: ["today", "yesterday", "7d", "30d"],
		default: "today",
	})
	@IsOptional()
	@IsIn(["today", "yesterday", "7d", "30d"])
	range: "today" | "yesterday" | "7d" | "30d" = "today";

	@ApiPropertyOptional({
		example: "2026-09-01",
		description:
			"Custom range start, a shop-local day (with `to`; replaces `range`). Advanced report.",
	})
	@IsOptional()
	@Matches(DAY, { message: "from must be YYYY-MM-DD" })
	from?: string;

	@ApiPropertyOptional({
		example: "2026-09-30",
		description:
			"Custom range end, inclusive, a shop-local day. At most 366 days after `from`.",
	})
	@IsOptional()
	@Matches(DAY, { message: "to must be YYYY-MM-DD" })
	to?: string;

	@ApiPropertyOptional({
		enum: ["previous", "year"],
		default: "previous",
		description:
			"What the changes compare against: the equal-length period just before, or the same dates a year earlier (advanced report).",
	})
	@IsOptional()
	@IsIn(["previous", "year"])
	compare: "previous" | "year" = "previous";
}
