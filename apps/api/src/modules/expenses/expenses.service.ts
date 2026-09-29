import { BusinessMember } from "@/models/businesses/entities/business-member.entity";
import { Expense } from "@/models/expenses/entities/expense.entity";
import { ExpenseRepository } from "@/models/expenses/expense.repository";
import {
	CreateExpenseDto,
	ExpenseResponse,
	ExpenseSummaryResponse,
	QueryExpensesDto,
	UpdateExpenseDto,
} from "@/modules/expenses/dto/expense.dto";
import type { ResolvedMembership } from "@/shared/decorators/current-membership.decorator";
import { OrderDirection } from "@/shared/dto/pagination.dto";
import { PaginatedResponse, paginate } from "@/shared/utils/pagination.util";
import { Injectable, NotFoundException } from "@nestjs/common";
import type { SelectQueryBuilder } from "typeorm";

const toResponse = (e: Expense): ExpenseResponse => ({
	id: e.id,
	category: e.category,
	amount: e.amount,
	note: e.note,
	spentOn: e.spentOn,
	recordedBy: e.recordedBy,
	createdAt: e.createdAt,
});

/** Expenses (plan §19), each keyed by the shop and stamped with who recorded it. */
@Injectable()
export class ExpensesService {
	constructor(private readonly expenseRepository: ExpenseRepository) {}

	private filtered(
		membership: ResolvedMembership,
		query: QueryExpensesDto
	): SelectQueryBuilder<Expense> {
		const qb = this.expenseRepository
			.createQueryBuilder("e")
			.where("e.businessId = :businessId", { businessId: membership.businessId });
		if (query.from) qb.andWhere("e.spentOn >= :from", { from: query.from });
		if (query.to) qb.andWhere("e.spentOn <= :to", { to: query.to });
		if (query.category)
			qb.andWhere("e.category = :category", { category: query.category });
		return qb;
	}

	async findAll(
		membership: ResolvedMembership,
		query: QueryExpensesDto
	): Promise<PaginatedResponse<ExpenseResponse>> {
		const qb = this.filtered(membership, query).addOrderBy("e.created_at", "DESC");
		const page = await paginate(
			qb,
			query,
			{ spentOn: "e.spent_on", amount: "e.amount" },
			{ expression: "e.spent_on", order: OrderDirection.DESC }
		);
		return page.map(toResponse);
	}

	/** The total and per-category split for the same filters as the list, across all pages. */
	async summary(
		membership: ResolvedMembership,
		query: QueryExpensesDto
	): Promise<ExpenseSummaryResponse> {
		const rows = (await this.filtered(membership, query)
			.select("e.category", "category")
			.addSelect("COALESCE(SUM(e.amount), 0)::bigint", "sum")
			.groupBy("e.category")
			.getRawMany()) as { category: string; sum: string }[];
		const byCategory = Object.fromEntries(
			rows.map((r) => [r.category, Number(r.sum)])
		);
		return { total: rows.reduce((s, r) => s + Number(r.sum), 0), byCategory };
	}

	async create(
		membership: ResolvedMembership,
		dto: CreateExpenseDto
	): Promise<ExpenseResponse> {
		const member = await this.expenseRepository.manager.findOneOrFail(
			BusinessMember,
			{
				where: { id: membership.memberId },
			}
		);
		const expense = await this.expenseRepository.save(
			this.expenseRepository.create({
				businessId: membership.businessId,
				category: dto.category,
				amount: dto.amount,
				note: dto.note || null,
				spentOn: dto.spentOn,
				memberId: membership.memberId,
				recordedBy: member.displayName,
			})
		);
		return toResponse(expense);
	}

	async update(
		membership: ResolvedMembership,
		id: string,
		dto: UpdateExpenseDto
	): Promise<ExpenseResponse> {
		const expense = await this.load(membership, id);
		if (dto.category !== undefined) expense.category = dto.category;
		if (dto.amount !== undefined) expense.amount = dto.amount;
		if (dto.note !== undefined) expense.note = dto.note || null;
		if (dto.spentOn !== undefined) expense.spentOn = dto.spentOn;
		return toResponse(await this.expenseRepository.save(expense));
	}

	async remove(membership: ResolvedMembership, id: string): Promise<void> {
		const expense = await this.load(membership, id);
		await this.expenseRepository.softDelete({ id: expense.id });
	}

	private async load(membership: ResolvedMembership, id: string): Promise<Expense> {
		const expense = await this.expenseRepository.findOne({
			where: { id, businessId: membership.businessId },
		});
		if (!expense) throw new NotFoundException("Expense not found");
		return expense;
	}
}
