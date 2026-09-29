import {
	CreateExpenseDto,
	ExpenseResponse,
	ExpenseSummaryResponse,
	QueryExpensesDto,
	UpdateExpenseDto,
} from "@/modules/expenses/dto/expense.dto";
import { ExpensesService } from "@/modules/expenses/expenses.service";
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

@ApiTags("expenses")
@ApiBearerAuth()
@Controller("businesses/:businessId/expenses")
@RequirePermission(Permission.EXPENSES_WRITE)
@RequireFeature(Feature.EXPENSES)
export class ExpensesController {
	constructor(private readonly expensesService: ExpensesService) {}

	@Get()
	@ApiOperation({ summary: "Expenses, newest day first" })
	@ApiOkResponse({ type: [ExpenseResponse] })
	findAll(
		@CurrentMembership() m: ResolvedMembership,
		@Query() query: QueryExpensesDto
	): Promise<PaginatedResponse<ExpenseResponse>> {
		return this.expensesService.findAll(m, query);
	}

	@Get("summary")
	@ApiOperation({ summary: "Total and per-category sums for the same filters" })
	@ApiOkResponse({ type: ExpenseSummaryResponse })
	summary(
		@CurrentMembership() m: ResolvedMembership,
		@Query() query: QueryExpensesDto
	): Promise<ExpenseSummaryResponse> {
		return this.expensesService.summary(m, query);
	}

	@Post()
	@ApiOkResponse({ type: ExpenseResponse })
	create(
		@CurrentMembership() m: ResolvedMembership,
		@Body() dto: CreateExpenseDto
	): Promise<ExpenseResponse> {
		return this.expensesService.create(m, dto);
	}

	@Patch(":expenseId")
	@ApiOkResponse({ type: ExpenseResponse })
	update(
		@CurrentMembership() m: ResolvedMembership,
		@Param("expenseId", ParseUUIDPipe) id: string,
		@Body() dto: UpdateExpenseDto
	): Promise<ExpenseResponse> {
		return this.expensesService.update(m, id, dto);
	}

	@Delete(":expenseId")
	@HttpCode(200)
	async remove(
		@CurrentMembership() m: ResolvedMembership,
		@Param("expenseId", ParseUUIDPipe) id: string
	): Promise<{ deleted: true }> {
		await this.expensesService.remove(m, id);
		return { deleted: true };
	}
}
