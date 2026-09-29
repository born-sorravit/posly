import {
	CheckoutDto,
	OrderResponse,
	QueryOrdersDto,
	ReverseOrderDto,
	SendReceiptDto,
} from "@/modules/orders/dto/order.dto";
import { OrdersService } from "@/modules/orders/orders.service";
import { ReceiptMailService } from "@/modules/orders/receipt-mail.service";
import { Throttle } from "@nestjs/throttler";
import { DemoBlocked } from "@/shared/decorators/demo-blocked.decorator";
import { CurrentMembership } from "@/shared/decorators/current-membership.decorator";
import type { ResolvedMembership } from "@/shared/decorators/current-membership.decorator";
import { RequirePermission } from "@/shared/decorators/require-permission.decorator";
import { Permission } from "@/shared/enums/permission.enum";
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
import {
	ApiBearerAuth,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
} from "@nestjs/swagger";

/**
 * Nested under the business, including refund and cancel: the tenant guard keys on
 * `:businessId`, so a top-level `/orders/:orderId` would have skipped it.
 */
@ApiTags("orders")
@ApiBearerAuth()
@Controller("businesses/:businessId/orders")
export class OrdersController {
	constructor(
		private readonly ordersService: OrdersService,
		private readonly receiptMail: ReceiptMailService
	) {}

	@Post()
	@HttpCode(200)
	@RequirePermission(Permission.POS_USE)
	@ApiOperation({
		summary: "Checkout: create a paid order",
		description:
			"Prices and totals are computed server-side. Idempotent on clientOrderId — a retry returns the existing order.",
	})
	@ApiOkResponse({ type: OrderResponse })
	checkout(
		@CurrentMembership() m: ResolvedMembership,
		@Body() dto: CheckoutDto
	): Promise<OrderResponse> {
		return this.ordersService.checkout(m, dto);
	}

	@Get()
	@RequirePermission(Permission.ORDERS_READ_OWN)
	@ApiOperation({ summary: "Orders, newest first; cashiers see only their own" })
	@ApiOkResponse({ type: [OrderResponse] })
	findAll(
		@CurrentMembership() m: ResolvedMembership,
		@Query() query: QueryOrdersDto
	): Promise<PaginatedResponse<OrderResponse>> {
		return this.ordersService.findAll(m, query);
	}

	@Get(":orderId")
	@RequirePermission(Permission.ORDERS_READ_OWN)
	@ApiOkResponse({ type: OrderResponse })
	findOne(
		@CurrentMembership() m: ResolvedMembership,
		@Param("orderId", ParseUUIDPipe) id: string
	): Promise<OrderResponse> {
		return this.ordersService.findOne(m, id);
	}

	@Post(":orderId/receipt-email")
	@DemoBlocked()
	@HttpCode(200)
	@Throttle({ default: { limit: 10, ttl: 60_000 } })
	@RequirePermission(Permission.ORDERS_READ_OWN)
	@ApiOperation({ summary: "Email the receipt to a customer" })
	sendReceipt(
		@CurrentMembership() m: ResolvedMembership,
		@Param("orderId", ParseUUIDPipe) id: string,
		@Body() dto: SendReceiptDto
	): Promise<{ delivered: boolean }> {
		return this.receiptMail.send(m, id, dto.email);
	}

	@Post(":orderId/refund")
	@HttpCode(200)
	@RequirePermission(Permission.ORDERS_REFUND)
	@ApiOperation({ summary: "Refund the whole order (audit-logged, restocks)" })
	@ApiOkResponse({ type: OrderResponse })
	refund(
		@CurrentMembership() m: ResolvedMembership,
		@Param("orderId", ParseUUIDPipe) id: string,
		@Body() dto: ReverseOrderDto
	): Promise<OrderResponse> {
		return this.ordersService.refund(m, id, dto);
	}

	@Post(":orderId/cancel")
	@HttpCode(200)
	@RequirePermission(Permission.ORDERS_CANCEL)
	@ApiOperation({ summary: "Cancel (void) a paid order (audit-logged, restocks)" })
	@ApiOkResponse({ type: OrderResponse })
	cancel(
		@CurrentMembership() m: ResolvedMembership,
		@Param("orderId", ParseUUIDPipe) id: string,
		@Body() dto: ReverseOrderDto
	): Promise<OrderResponse> {
		return this.ordersService.cancel(m, id, dto);
	}
}
