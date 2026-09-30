import {
	type AuthenticatedUser,
	CurrentUser,
} from "@/shared/decorators/current-user.decorator";
import { PlatformAdmin } from "@/shared/decorators/platform-admin.decorator";
import { PaginatedResponse } from "@/shared/utils/pagination.util";
import {
	Body,
	Controller,
	Get,
	HttpCode,
	Param,
	ParseUUIDPipe,
	Post,
	Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { AdminService } from "@/modules/admin/admin.service";
import {
	AdminActionRow,
	AdminActionsQueryDto,
	AdminActivityQueryDto,
	AdminAuditRow,
	AdminBusinessDetail,
	AdminBusinessRow,
	AdminBusinessesQueryDto,
	AdminOrderRow,
	AdminOverviewQueryDto,
	AdminOverviewResponse,
	AdminRecentOrdersQueryDto,
	AdminRevokeSessionsDto,
	AdminSetPlanDto,
	AdminSubscriptionRow,
	AdminSubscriptionSummary,
	AdminSubscriptionsQueryDto,
	AdminSystemResponse,
	AdminUserDetail,
	AdminUserRow,
	AdminUsersQueryDto,
} from "@/modules/admin/dto/admin.dto";

/**
 * The platform admin monitor (apps/admin). Reads across every shop, plus a few deliberate
 * actions (a shop's plan, a person's sessions), each written to `admin_action_log`.
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

	@Post("businesses/:id/subscription")
	@HttpCode(200)
	@ApiOperation({
		summary: "Put a shop on a plan by hand (not for Stripe-billed shops)",
	})
	setPlan(
		@CurrentUser() admin: AuthenticatedUser,
		@Param("id", ParseUUIDPipe) id: string,
		@Body() dto: AdminSetPlanDto
	): Promise<AdminBusinessDetail> {
		return this.adminService.setPlan(admin, id, dto);
	}

	@Get("users")
	@ApiOperation({ summary: "Every account" })
	users(
		@Query() query: AdminUsersQueryDto
	): Promise<PaginatedResponse<AdminUserRow>> {
		return this.adminService.users(query);
	}

	@Get("users/:id")
	@ApiOperation({ summary: "One account: shops, signed-in devices, admin actions" })
	user(@Param("id", ParseUUIDPipe) id: string): Promise<AdminUserDetail> {
		return this.adminService.user(id);
	}

	@Post("users/:id/sessions/revoke")
	@HttpCode(200)
	@ApiOperation({ summary: "Sign an account out of every device" })
	revokeSessions(
		@CurrentUser() admin: AuthenticatedUser,
		@Param("id", ParseUUIDPipe) id: string,
		@Body() dto: AdminRevokeSessionsDto
	): Promise<{ revoked: number }> {
		return this.adminService.revokeSessions(admin, id, dto);
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

	@Get("actions")
	@ApiOperation({ summary: "What platform admins changed, newest first" })
	actions(
		@Query() query: AdminActionsQueryDto
	): Promise<PaginatedResponse<AdminActionRow>> {
		return this.adminService.actions(query);
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
