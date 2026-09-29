import { CustomersService } from "@/modules/customers/customers.service";
import {
	CreateCustomerDto,
	CustomerResponse,
	QueryCustomersDto,
	UpdateCustomerDto,
} from "@/modules/customers/dto/customer.dto";
import { CurrentMembership } from "@/shared/decorators/current-membership.decorator";
import type { ResolvedMembership } from "@/shared/decorators/current-membership.decorator";
import { RequireFeature } from "@/shared/decorators/require-feature.decorator";
import { RequirePermission } from "@/shared/decorators/require-permission.decorator";
import { Permission } from "@/shared/enums/permission.enum";
import { Feature } from "@/shared/enums/subscription.enum";
import { PaginatedResponse } from "@/shared/utils/pagination.util";
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
	Query,
} from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
} from "@nestjs/swagger";

/** Cashiers hold `customers:write` by default: they add a customer at the counter. */
@ApiTags("customers")
@ApiBearerAuth()
@Controller("businesses/:businessId/customers")
@RequirePermission(Permission.CUSTOMERS_WRITE)
@RequireFeature(Feature.CUSTOMERS)
export class CustomersController {
	constructor(private readonly customersService: CustomersService) {}

	@Get()
	@ApiOperation({
		summary: "Customers with their paid orders, spending and last visit",
	})
	@ApiOkResponse({ type: [CustomerResponse] })
	findAll(
		@CurrentMembership() m: ResolvedMembership,
		@Query() query: QueryCustomersDto
	): Promise<PaginatedResponse<CustomerResponse>> {
		return this.customersService.findAll(m, query);
	}

	@Get(":customerId")
	@ApiOkResponse({ type: CustomerResponse })
	findOne(
		@CurrentMembership() m: ResolvedMembership,
		@Param("customerId", ParseUUIDPipe) id: string
	): Promise<CustomerResponse> {
		return this.customersService.findOne(m, id);
	}

	@Post()
	@ApiOkResponse({ type: CustomerResponse })
	create(
		@CurrentMembership() m: ResolvedMembership,
		@Body() dto: CreateCustomerDto
	): Promise<CustomerResponse> {
		return this.customersService.create(m, dto);
	}

	@Patch(":customerId")
	@ApiOkResponse({ type: CustomerResponse })
	update(
		@CurrentMembership() m: ResolvedMembership,
		@Param("customerId", ParseUUIDPipe) id: string,
		@Body() dto: UpdateCustomerDto
	): Promise<CustomerResponse> {
		return this.customersService.update(m, id, dto);
	}

	@Delete(":customerId")
	@HttpCode(200)
	async remove(
		@CurrentMembership() m: ResolvedMembership,
		@Param("customerId", ParseUUIDPipe) id: string
	): Promise<{ deleted: true }> {
		await this.customersService.remove(m, id);
		return { deleted: true };
	}
}
