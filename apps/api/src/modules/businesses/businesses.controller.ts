import {
	BusinessDetailResponse,
	BusinessSummaryResponse,
	CreateBusinessDto,
	UpdateBusinessDto,
} from "@/modules/businesses/dto/business.dto";
import { BusinessesService } from "@/modules/businesses/businesses.service";
import { DemoBlocked } from "@/shared/decorators/demo-blocked.decorator";
import { CurrentMembership } from "@/shared/decorators/current-membership.decorator";
import type { ResolvedMembership } from "@/shared/decorators/current-membership.decorator";
import { CurrentUser } from "@/shared/decorators/current-user.decorator";
import type { AuthenticatedUser } from "@/shared/decorators/current-user.decorator";
import { RequirePermission } from "@/shared/decorators/require-permission.decorator";
import { Permission } from "@/shared/enums/permission.enum";
import { Body, Controller, Get, HttpCode, Patch, Post } from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
} from "@nestjs/swagger";

/**
 * `:businessId` is always the route param named exactly that — `BusinessAccessGuard` keys on
 * the name, so a route that called it `:id` would silently skip the tenant check.
 */
@ApiTags("businesses")
@ApiBearerAuth()
@Controller("businesses")
export class BusinessesController {
	constructor(private readonly businessesService: BusinessesService) {}

	@Get()
	@ApiOperation({ summary: "Businesses the caller belongs to (store switcher)" })
	@ApiOkResponse({ type: [BusinessSummaryResponse] })
	findMine(
		@CurrentUser() user: AuthenticatedUser
	): Promise<BusinessSummaryResponse[]> {
		return this.businessesService.findMine(user.id);
	}

	@Post()
	@DemoBlocked()
	@ApiOperation({ summary: "Create a business; the caller becomes its OWNER" })
	@ApiOkResponse({ type: BusinessSummaryResponse })
	create(
		@CurrentUser() user: AuthenticatedUser,
		@Body() dto: CreateBusinessDto
	): Promise<BusinessSummaryResponse> {
		return this.businessesService.create(user.id, dto);
	}

	@Get(":businessId")
	@ApiOperation({ summary: "One business, with the caller's role and permissions" })
	@ApiOkResponse({ type: BusinessDetailResponse })
	findOne(
		@CurrentMembership() membership: ResolvedMembership
	): Promise<BusinessDetailResponse> {
		return this.businessesService.findOne(membership);
	}

	@Patch(":businessId")
	@DemoBlocked()
	@RequirePermission(Permission.BUSINESS_MANAGE)
	@ApiOperation({ summary: "Update store information" })
	@ApiOkResponse({ type: BusinessDetailResponse })
	update(
		@CurrentMembership() membership: ResolvedMembership,
		@Body() dto: UpdateBusinessDto
	): Promise<BusinessDetailResponse> {
		return this.businessesService.update(membership, dto);
	}

	@Post(":businessId/onboarding/complete")
	@HttpCode(200)
	@RequirePermission(Permission.BUSINESS_MANAGE)
	@ApiOperation({ summary: "Mark onboarding finished" })
	@ApiOkResponse({ type: BusinessDetailResponse })
	completeOnboarding(
		@CurrentMembership() membership: ResolvedMembership
	): Promise<BusinessDetailResponse> {
		return this.businessesService.completeOnboarding(membership);
	}
}
