import { ReportQueryDto } from "@/modules/reports/dto/report.dto";
import { ReportsService } from "@/modules/reports/reports.service";
import { CurrentMembership } from "@/shared/decorators/current-membership.decorator";
import type { ResolvedMembership } from "@/shared/decorators/current-membership.decorator";
import { RequireFeature } from "@/shared/decorators/require-feature.decorator";
import { RequirePermission } from "@/shared/decorators/require-permission.decorator";
import { Feature } from "@/shared/enums/subscription.enum";
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
		return this.reportsService.dashboard(m, query);
	}

	@Get("reports/insights")
	@RequirePermission(Permission.REPORTS_READ)
	@RequireFeature(Feature.ADVANCED_REPORT)
	@ApiOperation({
		summary:
			"Advanced report: busiest hours, profit by product and category, customers",
		description:
			"Same window as the dashboard (`range`, or `from`/`to`). Amounts are satang.",
	})
	insights(
		@CurrentMembership() m: ResolvedMembership,
		@Query() query: ReportQueryDto
	) {
		return this.reportsService.insights(m, query);
	}
}
