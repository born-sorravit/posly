import { PlatformAdmin } from "@/shared/decorators/platform-admin.decorator";
import { PaginatedResponse } from "@/shared/utils/pagination.util";
import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { AdminService } from "@/modules/admin/admin.service";
import {
	AdminActivityQueryDto,
	AdminAuditRow,
	AdminBusinessDetail,
	AdminBusinessRow,
	AdminBusinessesQueryDto,
	AdminOrderRow,
	AdminOverviewQueryDto,
	AdminOverviewResponse,
	AdminRecentOrdersQueryDto,
	AdminSubscriptionRow,
	AdminSubscriptionSummary,
	AdminSubscriptionsQueryDto,
	AdminSystemResponse,
	AdminUserRow,
	AdminUsersQueryDto,
} from "@/modules/admin/dto/admin.dto";

/**
 * The platform admin monitor (apps/admin). Read-only across every shop.
 *
 * No `:businessId` anywhere: `BusinessAccessGuard` would then require a membership in that
 * shop. Throttling is skipped because every admin request reaches us from the admin app's
 * server, one IP, and the pages poll; the routes are already behind JWT + the admin flag.
 */
@ApiTags("admin")
@ApiBearerAuth()
@PlatformAdmin()
@SkipThrottle()
@Controller("admin")
export class AdminController {
	constructor(private readonly adminService: AdminService) {}

	@Get("overview")
	@ApiOperation({ summary: "Platform KPIs and daily series" })
	overview(@Query() query: AdminOverviewQueryDto): Promise<AdminOverviewResponse> {
		return this.adminService.overview(query);
	}

	@Get("businesses")
	@ApiOperation({ summary: "Every shop, with plan and 30-day sales" })
	businesses(
		@Query() query: AdminBusinessesQueryDto
	): Promise<PaginatedResponse<AdminBusinessRow>> {
		return this.adminService.businesses(query);
	}

	@Get("businesses/:id")
	@ApiOperation({ summary: "One shop in detail" })
	business(@Param("id", ParseUUIDPipe) id: string): Promise<AdminBusinessDetail> {
		return this.adminService.business(id);
	}

	@Get("users")
	@ApiOperation({ summary: "Every account" })
	users(
		@Query() query: AdminUsersQueryDto
	): Promise<PaginatedResponse<AdminUserRow>> {
		return this.adminService.users(query);
	}

	@Get("subscriptions")
	@ApiOperation({ summary: "Every shop's subscription" })
	subscriptions(
		@Query() query: AdminSubscriptionsQueryDto
	): Promise<PaginatedResponse<AdminSubscriptionRow>> {
		return this.adminService.subscriptions(query);
	}

	@Get("subscriptions/summary")
	@ApiOperation({ summary: "Subscription counts by status, and MRR" })
	subscriptionSummary(
		@Query() query: AdminOverviewQueryDto
	): Promise<AdminSubscriptionSummary> {
		return this.adminService.subscriptionSummary(query.includeDemo);
	}

	@Get("activity")
	@ApiOperation({ summary: "Audit log across every shop" })
	activity(
		@Query() query: AdminActivityQueryDto
	): Promise<PaginatedResponse<AdminAuditRow>> {
		return this.adminService.activity(query);
	}

	@Get("orders/recent")
	@ApiOperation({ summary: "Latest orders across every shop" })
	recentOrders(@Query() query: AdminRecentOrdersQueryDto): Promise<AdminOrderRow[]> {
		return this.adminService.recentOrders(query);
	}

	@Get("system")
	@ApiOperation({ summary: "Database, cache and integration status" })
	system(): Promise<AdminSystemResponse> {
		return this.adminService.system();
	}
}
