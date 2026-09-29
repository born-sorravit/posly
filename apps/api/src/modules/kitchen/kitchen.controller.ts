import {
	KitchenBoardResponse,
	KitchenTicketResponse,
	QueryKitchenDto,
	SetKitchenStatusDto,
	SetPreparedDto,
} from "@/modules/kitchen/dto/kitchen.dto";
import { KitchenService } from "@/modules/kitchen/kitchen.service";
import { CurrentMembership } from "@/shared/decorators/current-membership.decorator";
import type { ResolvedMembership } from "@/shared/decorators/current-membership.decorator";
import { RequireFeature } from "@/shared/decorators/require-feature.decorator";
import { RequirePermission } from "@/shared/decorators/require-permission.decorator";
import { Permission } from "@/shared/enums/permission.enum";
import { Feature } from "@/shared/enums/subscription.enum";
import {
	Body,
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	Patch,
	Query,
} from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
} from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";

@ApiTags("kitchen")
@ApiBearerAuth()
@Controller("businesses/:businessId/kitchen")
@RequirePermission(Permission.KITCHEN_USE)
@RequireFeature(Feature.KITCHEN_DISPLAY)
export class KitchenController {
	constructor(private readonly kitchen: KitchenService) {}

	// Polled every few seconds by every kitchen screen in the shop.
	@Get()
	@SkipThrottle()
	@ApiOperation({ summary: "Open tickets, oldest first, and recently served ones" })
	@ApiOkResponse({ type: KitchenBoardResponse })
	board(
		@CurrentMembership() m: ResolvedMembership,
		@Query() query: QueryKitchenDto
	): Promise<KitchenBoardResponse> {
		return this.kitchen.board(m, query);
	}

	@Patch(":orderId")
	@ApiOperation({
		summary: "Move a ticket: NEW, PREPARING, READY or SERVED (also back, to undo)",
	})
	@ApiOkResponse({ type: KitchenTicketResponse })
	setStatus(
		@CurrentMembership() m: ResolvedMembership,
		@Param("orderId", ParseUUIDPipe) orderId: string,
		@Body() dto: SetKitchenStatusDto
	): Promise<KitchenTicketResponse> {
		return this.kitchen.setStatus(m, orderId, dto.status);
	}

	@Patch(":orderId/items/:itemId")
	@ApiOperation({ summary: "Tick one line off (or back on)" })
	@ApiOkResponse({ type: KitchenTicketResponse })
	setPrepared(
		@CurrentMembership() m: ResolvedMembership,
		@Param("orderId", ParseUUIDPipe) orderId: string,
		@Param("itemId", ParseUUIDPipe) itemId: string,
		@Body() dto: SetPreparedDto
	): Promise<KitchenTicketResponse> {
		return this.kitchen.setPrepared(m, orderId, itemId, dto.prepared);
	}
}
