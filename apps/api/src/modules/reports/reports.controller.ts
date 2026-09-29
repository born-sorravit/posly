import { ReportQueryDto } from "@/modules/reports/dto/report.dto";
import { ReportsService } from "@/modules/reports/reports.service";
import { CurrentMembership } from "@/shared/decorators/current-membership.decorator";
import type { ResolvedMembership } from "@/shared/decorators/current-membership.decorator";
import { RequirePermission } from "@/shared/decorators/require-permission.decorator";
import { Permission } from "@/shared/enums/permission.enum";
import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

@ApiTags("reports")
@ApiBearerAuth()
@Controller("businesses/:businessId")
export class ReportsController {
	constructor(private readonly reportsService: ReportsService) {}

	@Get("dashboard")
	@RequirePermission(Permission.REPORTS_READ)
	@ApiOperation({
		summary:
			"Metrics, sales series, top products, payments, employees and low stock",
		description:
			"Day boundaries are the business's local midnight. Amounts are satang.",
	})
	dashboard(
		@CurrentMembership() m: ResolvedMembership,
		@Query() query: ReportQueryDto
	) {
		return this.reportsService.dashboard(m, query.range);
	}
}
