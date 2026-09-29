import { Customer } from "@/models/customers/entities/customer.entity";
import { CustomerRepository } from "@/models/customers/customer.repository";
import {
	CreateCustomerDto,
	CustomerResponse,
	QueryCustomersDto,
	UpdateCustomerDto,
} from "@/modules/customers/dto/customer.dto";
import type { ResolvedMembership } from "@/shared/decorators/current-membership.decorator";
import {
	PaginatedResponse,
	getPaginationOptions,
} from "@/shared/utils/pagination.util";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";

interface StatsRow {
	id: string;
	total_orders: number;
	total_spending: string;
	last_visit_at: Date | null;
}

const isUniqueViolation = (error: unknown) =>
	typeof error === "object" &&
	error !== null &&
	"code" in error &&
	(error as { code: string }).code === "23505";

/**
 * Customers (plan §22). Totals come from the orders that name the customer: paid orders and
 * their spending (a refund takes an order out), and the last visit of any kind.
 */
@Injectable()
export class CustomersService {
	constructor(private readonly customerRepository: CustomerRepository) {}

	async findAll(
		membership: ResolvedMembership,
		query: QueryCustomersDto
	): Promise<PaginatedResponse<CustomerResponse>> {
		const { page, limit, skip } = getPaginationOptions(query);
		const qb = this.customerRepository
			.createQueryBuilder("c")
			.where("c.businessId = :businessId", { businessId: membership.businessId });
		if (query.search) {
			const term = `%${query.search.replace(/[\\%_]/g, "\\$&")}%`;
			const phone = query.search.replace(/\D/g, "");
			qb.andWhere(
				phone.length >= 3
					? "(c.name ILIKE :term OR c.email ILIKE :term OR c.phone LIKE :phone)"
					: "(c.name ILIKE :term OR c.email ILIKE :term)",
				{ term, phone: `%${phone}%` }
			);
		}
		// Most recent customers first: the regulars a cashier is most likely looking for.
		const [rows, total] = await qb
			.orderBy("c.updated_at", "DESC")
			.skip(skip)
			.take(limit)
			.getManyAndCount();
		const stats = await this.stats(
			membership.businessId,
			rows.map((c) => c.id)
		);
		return new PaginatedResponse(
			rows.map((c) => this.toResponse(c, stats.get(c.id))),
			total,
			page,
			limit
		);
	}

	async findOne(
		membership: ResolvedMembership,
		id: string
	): Promise<CustomerResponse> {
		const customer = await this.load(membership, id);
		return this.toResponse(
			customer,
			(await this.stats(membership.businessId, [id])).get(id)
		);
	}

	async create(
		membership: ResolvedMembership,
		dto: CreateCustomerDto
	): Promise<CustomerResponse> {
		const customer = this.customerRepository.create({
			businessId: membership.businessId,
			name: dto.name,
			phone: dto.phone ?? null,
			email: dto.email || null,
			note: dto.note || null,
		});
		return this.toResponse(await this.save(customer), undefined);
	}

	async update(
		membership: ResolvedMembership,
		id: string,
		dto: UpdateCustomerDto
	): Promise<CustomerResponse> {
		const customer = await this.load(membership, id);
		if (dto.name !== undefined) customer.name = dto.name;
		if (dto.phone !== undefined) customer.phone = dto.phone ?? null;
		if (dto.email !== undefined) customer.email = dto.email || null;
		if (dto.note !== undefined) customer.note = dto.note || null;
		await this.save(customer);
		return this.findOne(membership, id);
	}

	/** Soft delete: orders keep the name they were sold under. */
	async remove(membership: ResolvedMembership, id: string): Promise<void> {
		const customer = await this.load(membership, id);
		await this.customerRepository.softDelete({ id: customer.id });
	}

	/** The customer for a checkout, or 404 — never another shop's. */
	async load(membership: ResolvedMembership, id: string): Promise<Customer> {
		const customer = await this.customerRepository.findOne({
			where: { id, businessId: membership.businessId },
		});
		if (!customer) throw new NotFoundException("Customer not found");
		return customer;
	}

	private async save(customer: Customer): Promise<Customer> {
		try {
			return await this.customerRepository.save(customer);
		} catch (error) {
			if (isUniqueViolation(error))
				throw new ConflictException("A customer with this phone already exists");
			throw error;
		}
	}

	private async stats(
		businessId: string,
		ids: string[]
	): Promise<Map<string, StatsRow>> {
		if (ids.length === 0) return new Map();
		const rows = (await this.customerRepository.query(
			`SELECT customer_id AS id,
			        COUNT(*) FILTER (WHERE status = 'PAID')::int AS total_orders,
			        COALESCE(SUM(total) FILTER (WHERE status = 'PAID'), 0)::bigint AS total_spending,
			        MAX(created_at) AS last_visit_at
			 FROM "order"
			 WHERE business_id = $1 AND customer_id = ANY($2) AND deleted_at IS NULL
			 GROUP BY customer_id`,
			[businessId, ids]
		)) as StatsRow[];
		return new Map(rows.map((r) => [r.id, r]));
	}

	private toResponse(c: Customer, stats: StatsRow | undefined): CustomerResponse {
		return {
			id: c.id,
			name: c.name,
			phone: c.phone,
			email: c.email,
			note: c.note,
			totalOrders: stats?.total_orders ?? 0,
			totalSpending: Number(stats?.total_spending ?? 0),
			lastVisitAt: stats?.last_visit_at
				? new Date(stats.last_visit_at).toISOString()
				: null,
			createdAt: c.createdAt,
		};
	}
}
