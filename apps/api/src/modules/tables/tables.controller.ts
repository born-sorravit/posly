import { OrderResponse } from "@/modules/orders/dto/order.dto";
import {
	AddRoundDto,
	BoardTableResponse,
	CancelTabDto,
	CloseTabDto,
	CreateTableDto,
	GuestCallDto,
	GuestMenuResponse,
	GuestRequestDto,
	GuestTabResponse,
	MergeTabDto,
	MoveTabDto,
	OpenTableDto,
	SplitTabDto,
	TableCallResponse,
	TabResponse,
	TableResponse,
	UpdateTableDto,
} from "@/modules/tables/dto/table.dto";
import { GuestTablesService } from "@/modules/tables/guest-tables.service";
import { TablesService } from "@/modules/tables/tables.service";
import { CurrentMembership } from "@/shared/decorators/current-membership.decorator";
import type { ResolvedMembership } from "@/shared/decorators/current-membership.decorator";
import { Public } from "@/shared/decorators/public.decorator";
import { RequireFeature } from "@/shared/decorators/require-feature.decorator";
import { RequirePermission } from "@/shared/decorators/require-permission.decorator";
import { Feature } from "@/shared/enums/subscription.enum";
import { Permission } from "@/shared/enums/permission.enum";
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
} from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

/**
 * Setting tables up is shop settings; working the floor is the till's job. The plan gates
 * only what starts new work (a table, a tab, a round): a shop that downgrades with a tab
 * still open can always see it, take its payment, cancel it or turn a round down.
 */
@ApiTags("tables")
@ApiBearerAuth()
@Controller("businesses/:businessId")
export class TablesController {
	constructor(private readonly tablesService: TablesService) {}

	@Get("tables")
	@RequirePermission(Permission.POS_USE)
	@ApiOkResponse({ type: [TableResponse] })
	findAll(@CurrentMembership() m: ResolvedMembership): Promise<TableResponse[]> {
		return this.tablesService.findAll(m);
	}

	@Get("tables/board")
	@RequirePermission(Permission.POS_USE)
	@ApiOperation({ summary: "Every table with its open tab, for the floor screen" })
	@ApiOkResponse({ type: [BoardTableResponse] })
	board(@CurrentMembership() m: ResolvedMembership): Promise<BoardTableResponse[]> {
		return this.tablesService.board(m);
	}

	@Post("tables")
	@RequireFeature(Feature.TABLES)
	@RequirePermission(Permission.SETTINGS_MANAGE)
	@ApiOkResponse({ type: TableResponse })
	create(
		@CurrentMembership() m: ResolvedMembership,
		@Body() dto: CreateTableDto
	): Promise<TableResponse> {
		return this.tablesService.create(m, dto);
	}

	@Patch("tables/:tableId")
	@RequireFeature(Feature.TABLES)
	@RequirePermission(Permission.SETTINGS_MANAGE)
	@ApiOkResponse({ type: TableResponse })
	update(
		@CurrentMembership() m: ResolvedMembership,
		@Param("tableId", ParseUUIDPipe) id: string,
		@Body() dto: UpdateTableDto
	): Promise<TableResponse> {
		return this.tablesService.update(m, id, dto);
	}

	@Delete("tables/:tableId")
	@HttpCode(200)
	@RequirePermission(Permission.SETTINGS_MANAGE)
	async remove(
		@CurrentMembership() m: ResolvedMembership,
		@Param("tableId", ParseUUIDPipe) id: string
	): Promise<{ deleted: true }> {
		await this.tablesService.remove(m, id);
		return { deleted: true };
	}

	@Post("tables/:tableId/rotate-qr")
	@RequireFeature(Feature.TABLES)
	@HttpCode(200)
	@RequirePermission(Permission.SETTINGS_MANAGE)
	@ApiOperation({
		summary: "A new QR for the table; printed copies of the old one stop working",
	})
	@ApiOkResponse({ type: TableResponse })
	rotateQr(
		@CurrentMembership() m: ResolvedMembership,
		@Param("tableId", ParseUUIDPipe) id: string
	): Promise<TableResponse> {
		return this.tablesService.rotateQr(m, id);
	}

	@Post("tables/:tableId/call/dismiss")
	@HttpCode(200)
	@RequirePermission(Permission.POS_USE)
	@ApiOperation({ summary: "Acknowledge a guest's call for staff or the bill" })
	@ApiOkResponse({ type: TableResponse })
	dismissCall(
		@CurrentMembership() m: ResolvedMembership,
		@Param("tableId", ParseUUIDPipe) id: string
	): Promise<TableResponse> {
		return this.tablesService.dismissCall(m, id);
	}

	@Post("tables/:tableId/open")
	@RequireFeature(Feature.TABLES)
	@RequirePermission(Permission.POS_USE)
	@ApiOperation({ summary: "Open a tab on the table; its QR starts taking orders" })
	@ApiOkResponse({ type: TabResponse })
	open(
		@CurrentMembership() m: ResolvedMembership,
		@Param("tableId", ParseUUIDPipe) id: string,
		@Body() dto: OpenTableDto
	): Promise<TabResponse> {
		return this.tablesService.open(m, id, dto);
	}

	@Get("table-sessions/:sessionId")
	@RequirePermission(Permission.POS_USE)
	@ApiOkResponse({ type: TabResponse })
	tab(
		@CurrentMembership() m: ResolvedMembership,
		@Param("sessionId", ParseUUIDPipe) id: string
	): Promise<TabResponse> {
		return this.tablesService.tab(m, id);
	}

	@Post("table-sessions/:sessionId/items")
	@RequireFeature(Feature.TABLES)
	@HttpCode(200)
	@RequirePermission(Permission.POS_USE)
	@ApiOperation({ summary: "Add a round from the till, straight to the tab" })
	@ApiOkResponse({ type: TabResponse })
	addRound(
		@CurrentMembership() m: ResolvedMembership,
		@Param("sessionId", ParseUUIDPipe) id: string,
		@Body() dto: AddRoundDto
	): Promise<TabResponse> {
		return this.tablesService.addRound(m, id, dto);
	}

	@Post("table-sessions/:sessionId/move")
	@HttpCode(200)
	@RequirePermission(Permission.POS_USE)
	@RequireFeature(Feature.TABLES)
	@ApiOperation({ summary: "Move the tab to a free table in the same branch" })
	@ApiOkResponse({ type: TabResponse })
	move(
		@CurrentMembership() m: ResolvedMembership,
		@Param("sessionId", ParseUUIDPipe) id: string,
		@Body() dto: MoveTabDto
	): Promise<TabResponse> {
		return this.tablesService.move(m, id, dto);
	}

	@Post("table-sessions/:sessionId/merge")
	@HttpCode(200)
	@RequirePermission(Permission.POS_USE)
	@RequireFeature(Feature.TABLES)
	@ApiOperation({
		summary: "Bring another open tab's lines onto this one and free its table",
	})
	@ApiOkResponse({ type: TabResponse })
	merge(
		@CurrentMembership() m: ResolvedMembership,
		@Param("sessionId", ParseUUIDPipe) id: string,
		@Body() dto: MergeTabDto
	): Promise<TabResponse> {
		return this.tablesService.merge(m, id, dto);
	}

	/** Not plan-gated, like check-out: a shop past its plan can still settle an open tab. */
	@Post("table-sessions/:sessionId/split")
	@HttpCode(200)
	@RequirePermission(Permission.POS_USE)
	@ApiOperation({ summary: "Pay part of the tab now, as its own order" })
	@ApiOkResponse({ type: OrderResponse })
	split(
		@CurrentMembership() m: ResolvedMembership,
		@Param("sessionId", ParseUUIDPipe) id: string,
		@Body() dto: SplitTabDto
	): Promise<OrderResponse> {
		return this.tablesService.split(m, id, dto);
	}

	@Post("table-sessions/:sessionId/close")
	@HttpCode(200)
	@RequirePermission(Permission.POS_USE)
	@ApiOperation({
		summary: "Check out: take payment for the whole tab and free the table",
	})
	@ApiOkResponse({ type: OrderResponse })
	close(
		@CurrentMembership() m: ResolvedMembership,
		@Param("sessionId", ParseUUIDPipe) id: string,
		@Body() dto: CloseTabDto
	): Promise<OrderResponse> {
		return this.tablesService.close(m, id, dto);
	}

	@Post("table-sessions/:sessionId/cancel")
	@HttpCode(200)
	@RequirePermission(Permission.POS_USE)
	@ApiOperation({
		summary: "Void the tab; a tab with rounds on it also needs orders:cancel",
	})
	cancel(
		@CurrentMembership() m: ResolvedMembership,
		@Param("sessionId", ParseUUIDPipe) id: string,
		@Body() dto: CancelTabDto
	): Promise<{ cancelled: true }> {
		return this.tablesService.cancel(m, id, dto);
	}

	@Post("table-requests/:requestId/accept")
	@RequireFeature(Feature.TABLES)
	@HttpCode(200)
	@RequirePermission(Permission.POS_USE)
	@ApiOperation({
		summary: "Accept a guest's round onto the tab and send it to the kitchen",
	})
	@ApiOkResponse({ type: TabResponse })
	accept(
		@CurrentMembership() m: ResolvedMembership,
		@Param("requestId", ParseUUIDPipe) id: string
	): Promise<TabResponse> {
		return this.tablesService.accept(m, id);
	}

	@Post("table-requests/:requestId/reject")
	@HttpCode(200)
	@RequirePermission(Permission.POS_USE)
	@ApiOkResponse({ type: TabResponse })
	reject(
		@CurrentMembership() m: ResolvedMembership,
		@Param("requestId", ParseUUIDPipe) id: string
	): Promise<TabResponse> {
		return this.tablesService.reject(m, id);
	}
}

/**
 * Per IP, and a restaurant's guests usually share one Wi-Fi address: generous enough for a
 * full room polling its bills. Spam at one table is held back by its pending-round cap.
 */
const READ_THROTTLE = { default: { limit: 600, ttl: 60_000 } };
const SEND_THROTTLE = { default: { limit: 60, ttl: 60_000 } };

/** The QR on a table: no login, the token identifies the table (and so the shop). */
@ApiTags("tables")
@Controller("public/tables")
export class GuestTablesController {
	constructor(private readonly guestTables: GuestTablesService) {}

	@Public()
	@Throttle(READ_THROTTLE)
	@Get(":token")
	@ApiOperation({
		summary: "The shop's menu for a table, and whether it is taking orders",
	})
	@ApiOkResponse({ type: GuestMenuResponse })
	menu(@Param("token") token: string): Promise<GuestMenuResponse> {
		return this.guestTables.menu(token);
	}

	@Public()
	@Throttle(READ_THROTTLE)
	@Get(":token/tab")
	@ApiOperation({
		summary: "The table's bill so far and its rounds waiting for staff",
	})
	@ApiOkResponse({ type: GuestTabResponse })
	tab(@Param("token") token: string): Promise<GuestTabResponse> {
		return this.guestTables.tab(token);
	}

	@Public()
	@Throttle(SEND_THROTTLE)
	@Post(":token/call")
	@HttpCode(200)
	@ApiOperation({ summary: "Call for staff, or ask for the bill" })
	@ApiOkResponse({ type: TableCallResponse })
	call(
		@Param("token") token: string,
		@Body() dto: GuestCallDto
	): Promise<TableCallResponse> {
		return this.guestTables.call(token, dto);
	}

	@Public()
	@Throttle(SEND_THROTTLE)
	@Post(":token/requests")
	@ApiOperation({
		summary: "Send a round; staff accept it before it reaches the kitchen",
	})
	@ApiOkResponse({ type: GuestTabResponse })
	request(
		@Param("token") token: string,
		@Body() dto: GuestRequestDto
	): Promise<GuestTabResponse> {
		return this.guestTables.request(token, dto);
	}
}
