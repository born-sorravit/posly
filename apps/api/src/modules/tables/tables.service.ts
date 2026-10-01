import { Branch } from "@/models/branches/entities/branch.entity";
import { BusinessMember } from "@/models/businesses/entities/business-member.entity";
import { Business } from "@/models/businesses/entities/business.entity";
import { Product } from "@/models/catalog/entities/product.entity";
import { OrderItem } from "@/models/orders/entities/order-item.entity";
import { Order } from "@/models/orders/entities/order.entity";
import { Payment } from "@/models/orders/entities/payment.entity";
import { DiningTable } from "@/models/tables/entities/dining-table.entity";
import {
	TableRequest,
	type TableRequestLine,
} from "@/models/tables/entities/table-request.entity";
import { TableSession } from "@/models/tables/entities/table-session.entity";
import { OrderResponse } from "@/modules/orders/dto/order.dto";
import { OrdersService } from "@/modules/orders/orders.service";
import { allocateDiscount, computeOrderTotals } from "@/modules/orders/pricing";
import { RealtimeService } from "@/modules/realtime/realtime.service";
import { EntitlementsService } from "@/modules/subscriptions/entitlements.service";
import {
	AddRoundDto,
	BoardTableResponse,
	CancelTabDto,
	CloseTabDto,
	CreateTableDto,
	OpenTableDto,
	TabResponse,
	TableRequestResponse,
	TableResponse,
	UpdateTableDto,
} from "@/modules/tables/dto/table.dto";
import { mergeUsage } from "@/modules/tables/merge-usage";
import { CacheKeys } from "@/shared/cache/cache-keys";
import { CacheService } from "@/shared/cache/cache.service";
import type { ResolvedMembership } from "@/shared/decorators/current-membership.decorator";
import { AuditAction } from "@/shared/enums/audit-action.enum";
import {
	KitchenStatus,
	OrderStatus,
	PaymentMethod,
	PaymentStatus,
	ServiceType,
} from "@/shared/enums/order.enum";
import { Permission } from "@/shared/enums/permission.enum";
import { TableRequestStatus, TableSessionStatus } from "@/shared/enums/table.enum";
import { Money } from "@/shared/utils/money.util";
import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { DataSource, EntityManager, In } from "typeorm";

export const newQrToken = (): string => randomBytes(24).toString("base64url");

const isUniqueViolation = (error: unknown): boolean =>
	typeof error === "object" &&
	error !== null &&
	"code" in error &&
	error.code === "23505";

/**
 * Tables and their tabs. A tab (`TableSession`) is opened by staff; rounds go into one
 * PENDING_PAYMENT order — created with the first round — that cooks as it goes and is paid
 * once, when the table checks out. Guests send rounds from the QR as requests that wait for
 * a member of staff to accept them; nothing a guest sends touches stock or the bill until then.
 */
@Injectable()
export class TablesService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly orders: OrdersService,
		private readonly realtime: RealtimeService,
		private readonly cacheService: CacheService,
		private readonly entitlements: EntitlementsService
	) {}

	// ------------------------------------------------------------ setup

	async findAll(membership: ResolvedMembership): Promise<TableResponse[]> {
		const tables = await this.dataSource.getRepository(DiningTable).find({
			where: {
				businessId: membership.businessId,
				...(membership.branchIds ? { branchId: In(membership.branchIds) } : {}),
			},
			order: { displayOrder: "ASC", createdAt: "ASC" },
		});
		return tables.map(toTableResponse);
	}

	async create(
		membership: ResolvedMembership,
		dto: CreateTableDto
	): Promise<TableResponse> {
		const branch = await this.resolveBranch(membership, dto.branchId);
		await this.entitlements.assertTableSlot(
			this.dataSource.manager,
			membership.businessId
		);
		const repo = this.dataSource.getRepository(DiningTable);
		const table = repo.create({
			businessId: membership.businessId,
			branchId: branch.id,
			name: dto.name,
			zone: dto.zone || null,
			seats: dto.seats ?? null,
			displayOrder:
				dto.displayOrder ?? (await repo.count({ where: { branchId: branch.id } })),
			isActive: dto.isActive ?? true,
			qrToken: newQrToken(),
		});
		return toTableResponse(await this.saveTable(table));
	}

	async update(
		membership: ResolvedMembership,
		id: string,
		dto: UpdateTableDto
	): Promise<TableResponse> {
		const table = await this.loadTable(membership, id);
		if (dto.branchId !== undefined && dto.branchId !== table.branchId) {
			if (await this.openSession(this.dataSource.manager, table.id))
				throw new ConflictException("Close the table's tab before moving it");
			table.branchId = (await this.resolveBranch(membership, dto.branchId)).id;
		}
		if (dto.name !== undefined) table.name = dto.name;
		if (dto.zone !== undefined) table.zone = dto.zone || null;
		if (dto.seats !== undefined) table.seats = dto.seats;
		if (dto.displayOrder !== undefined) table.displayOrder = dto.displayOrder;
		if (dto.isActive !== undefined) table.isActive = dto.isActive;
		return toTableResponse(await this.saveTable(table));
	}

	async remove(membership: ResolvedMembership, id: string): Promise<void> {
		const table = await this.loadTable(membership, id);
		if (await this.openSession(this.dataSource.manager, table.id))
			throw new ConflictException("Close the table's tab before deleting it");
		await this.dataSource.getRepository(DiningTable).softRemove(table);
	}

	/** A new QR for the table: every printed copy of the old one stops working. */
	async rotateQr(
		membership: ResolvedMembership,
		id: string
	): Promise<TableResponse> {
		const table = await this.loadTable(membership, id);
		table.qrToken = newQrToken();
		return toTableResponse(
			await this.dataSource.getRepository(DiningTable).save(table)
		);
	}

	// ------------------------------------------------------------ the floor

	/** Every table with its open tab, if any, for the floor screen. */
	async board(membership: ResolvedMembership): Promise<BoardTableResponse[]> {
		const tables = await this.findAll(membership);
		if (!tables.length) return [];
		const sessions = await this.dataSource.getRepository(TableSession).find({
			where: {
				tableId: In(tables.map((t) => t.id)),
				status: TableSessionStatus.OPEN,
			},
		});
		const orderIds = sessions.map((s) => s.orderId).filter((o): o is string => !!o);
		const orders = orderIds.length
			? await this.dataSource.getRepository(Order).find({
					where: { id: In(orderIds) },
					relations: { items: true },
				})
			: [];
		const orderById = new Map(orders.map((o) => [o.id, o]));
		const pending = sessions.length
			? ((await this.dataSource
					.getRepository(TableRequest)
					.createQueryBuilder("r")
					.select("r.session_id", "sessionId")
					.addSelect("COUNT(*)::int", "count")
					.where("r.session_id IN (:...ids)", { ids: sessions.map((s) => s.id) })
					.andWhere("r.status = :pending", { pending: TableRequestStatus.PENDING })
					.groupBy("r.session_id")
					.getRawMany()) as { sessionId: string; count: number }[])
			: [];
		const pendingBySession = new Map(pending.map((p) => [p.sessionId, p.count]));
		const sessionByTable = new Map(sessions.map((s) => [s.tableId, s]));

		return tables.map((table) => {
			const session = sessionByTable.get(table.id);
			const order = session?.orderId ? orderById.get(session.orderId) : undefined;
			return {
				...table,
				tab: session
					? {
							id: session.id,
							guests: session.guests,
							openedAt: session.openedAt.toISOString(),
							total: order?.total ?? 0,
							itemCount: (order?.items ?? []).reduce((n, i) => n + i.quantity, 0),
							pendingRequests: pendingBySession.get(session.id) ?? 0,
						}
					: null,
			};
		});
	}

	async open(
		membership: ResolvedMembership,
		tableId: string,
		dto: OpenTableDto
	): Promise<TabResponse> {
		const table = await this.loadTable(membership, tableId);
		if (!table.isActive) throw new ConflictException("This table is turned off");
		try {
			const session = await this.dataSource.transaction(async (manager) => {
				const saved = await manager.save(
					manager.create(TableSession, {
						businessId: table.businessId,
						branchId: table.branchId,
						tableId: table.id,
						status: TableSessionStatus.OPEN,
						guests: dto.guests ?? null,
						openedByMemberId: membership.memberId,
						openedAt: new Date(),
						orderId: null,
					})
				);
				await this.announce(manager, saved, ["tables"]);
				return saved;
			});
			return this.tab(membership, session.id);
		} catch (error) {
			// The partial unique index: someone else opened this table a moment ago.
			if (isUniqueViolation(error))
				throw new ConflictException("This table is already open");
			throw error;
		}
	}

	async tab(
		membership: ResolvedMembership,
		sessionId: string
	): Promise<TabResponse> {
		const session = await this.loadSession(
			this.dataSource.manager,
			membership,
			sessionId
		);
		const table = await this.dataSource
			.getRepository(DiningTable)
			.findOneOrFail({ where: { id: session.tableId }, withDeleted: true });
		const order = session.orderId ? await this.loadOrder(session.orderId) : null;
		const requests = await this.dataSource.getRepository(TableRequest).find({
			where: { sessionId: session.id },
			order: { createdAt: "ASC" },
		});
		return {
			id: session.id,
			tableId: table.id,
			tableName: table.name,
			status: session.status,
			guests: session.guests,
			openedAt: session.openedAt.toISOString(),
			orderId: order?.id ?? null,
			orderNumber: order ? String(order.number).padStart(6, "0") : null,
			kitchenStatus: order?.kitchenStatus ?? null,
			lines: sortedItems(order).map((item) => ({
				id: item.id,
				name: item.name,
				quantity: item.quantity,
				unitPrice: item.unitPrice,
				lineTotal: item.lineTotal,
				modifiers: (item.modifiers ?? []).map((m) => m.optionName),
				note: item.note,
				round: item.round,
				toKitchen: item.toKitchen,
				preparedAt: item.preparedAt?.toISOString() ?? null,
			})),
			subtotal: order?.subtotal ?? 0,
			vat: order?.vat ?? 0,
			total: order?.total ?? 0,
			requests: await this.describeRequests(session.businessId, requests),
		};
	}

	/** Staff add a round from the till; it goes straight onto the tab. */
	async addRound(
		membership: ResolvedMembership,
		sessionId: string,
		dto: AddRoundDto
	): Promise<TabResponse> {
		const lines = dto.items.map(toRequestLine);
		try {
			await this.dataSource.transaction(async (manager) => {
				const session = await this.lockOpenSession(manager, membership, sessionId);
				const existing = await manager.findOne(TableRequest, {
					where: { sessionId: session.id, clientRequestId: dto.clientRequestId },
				});
				// A retried round: it is already on the tab.
				if (existing) return;
				await manager.save(
					manager.create(TableRequest, {
						businessId: session.businessId,
						branchId: session.branchId,
						sessionId: session.id,
						clientRequestId: dto.clientRequestId,
						items: lines,
						status: TableRequestStatus.ACCEPTED,
						handledByMemberId: membership.memberId,
						handledAt: new Date(),
					})
				);
				await this.appendRound(manager, membership, session, lines);
			});
		} catch (error) {
			// Two copies of the same retry raced past the check; the round went on once.
			if (!isUniqueViolation(error)) throw error;
		}
		await this.cacheService.bump(CacheKeys.dashboardVersion(membership.businessId));
		return this.tab(membership, sessionId);
	}

	/** A guest's round, accepted: priced now, out of stock now, into the kitchen now. */
	async accept(
		membership: ResolvedMembership,
		requestId: string
	): Promise<TabResponse> {
		const sessionId = await this.dataSource.transaction(async (manager) => {
			const request = await this.lockPendingRequest(manager, membership, requestId);
			const session = await this.lockOpenSession(
				manager,
				membership,
				request.sessionId
			);
			await this.appendRound(manager, membership, session, request.items);
			await manager.update(
				TableRequest,
				{ id: request.id },
				{
					status: TableRequestStatus.ACCEPTED,
					handledByMemberId: membership.memberId,
					handledAt: new Date(),
				}
			);
			return session.id;
		});
		await this.cacheService.bump(CacheKeys.dashboardVersion(membership.businessId));
		return this.tab(membership, sessionId);
	}

	async reject(
		membership: ResolvedMembership,
		requestId: string
	): Promise<TabResponse> {
		const sessionId = await this.dataSource.transaction(async (manager) => {
			const request = await this.lockPendingRequest(manager, membership, requestId);
			await manager.update(
				TableRequest,
				{ id: request.id },
				{
					status: TableRequestStatus.REJECTED,
					handledByMemberId: membership.memberId,
					handledAt: new Date(),
				}
			);
			// Locked: a guest's next round cannot slip in while the table is being freed.
			const session = await this.lockOpenSession(
				manager,
				membership,
				request.sessionId
			);
			// A guest opened the table and its only round was turned down: free the table again,
			// so a photographed QR cannot leave tables looking taken.
			const pending = await manager.count(TableRequest, {
				where: { sessionId: session.id, status: TableRequestStatus.PENDING },
			});
			if (
				session.openedByMemberId === null &&
				session.orderId === null &&
				pending === 0
			)
				await this.finish(manager, session, TableSessionStatus.CANCELLED);
			await this.announce(manager, session, ["tables"]);
			return session.id;
		});
		return this.tab(membership, sessionId);
	}

	/**
	 * Check-out: the whole tab is priced once more with the discount spread over every line,
	 * paid, and the table freed. Whoever takes the money is the one the order is rung up by.
	 */
	async close(
		membership: ResolvedMembership,
		sessionId: string,
		dto: CloseTabDto
	): Promise<OrderResponse> {
		if (
			(dto.discount ?? 0) > 0 &&
			!membership.permissions.includes(Permission.ORDERS_DISCOUNT)
		) {
			throw new ForbiddenException("You are not allowed to give discounts");
		}
		const orderId = await this.dataSource.transaction(async (manager) => {
			const session = await this.lockOpenSession(manager, membership, sessionId);
			if (!session.orderId)
				throw new ConflictException("Nothing on this tab yet; cancel it instead");
			const order = await manager
				.getRepository(Order)
				.createQueryBuilder("ord")
				.setLock("pessimistic_write")
				.where("ord.id = :id", { id: session.orderId })
				.getOneOrFail();
			const items = await manager.find(OrderItem, {
				where: { orderId: order.id },
				order: { createdAt: "ASC" },
			});

			const totals = computeOrderTotals(
				items,
				dto.discount ?? 0,
				order.vatBasisPoints,
				order.pricesIncludeVat
			);
			const shares = allocateDiscount(
				items.map((i) => i.lineTotal),
				totals.discount
			);
			const cash = dto.payment.method === PaymentMethod.CASH;
			const received = cash ? (dto.payment.received ?? totals.total) : null;
			if (received !== null && received < totals.total) {
				throw new BadRequestException("Cash received is less than the total");
			}

			for (const [index, item] of items.entries()) {
				if (item.discount !== shares[index])
					await manager.update(
						OrderItem,
						{ id: item.id },
						{ discount: shares[index] }
					);
			}
			const member = await manager.findOneOrFail(BusinessMember, {
				where: { id: membership.memberId },
			});
			const now = new Date();
			await manager.update(
				Order,
				{ id: order.id },
				{
					...totals,
					status: OrderStatus.PAID,
					paidAt: now,
					memberId: member.id,
					employeeName: member.displayName,
				}
			);
			await manager.save(
				manager.create(Payment, {
					orderId: order.id,
					businessId: order.businessId,
					method: dto.payment.method,
					status: PaymentStatus.SUCCESS,
					amount: totals.total,
					received,
					change: received === null ? null : Money.subtract(received, totals.total),
					reference: null,
				})
			);
			await this.finish(manager, session, TableSessionStatus.CLOSED);
			await this.announce(manager, session, ["tables", "orders"]);
			return order.id;
		});
		await this.cacheService.bump(CacheKeys.dashboardVersion(membership.businessId));
		return this.orders.findOne(membership, orderId);
	}

	/** Voids the tab: what was taken from stock goes back, and the order is cancelled. */
	async cancel(
		membership: ResolvedMembership,
		sessionId: string,
		dto: CancelTabDto
	): Promise<{ cancelled: true }> {
		await this.dataSource.transaction(async (manager) => {
			const session = await this.lockOpenSession(manager, membership, sessionId);
			if (session.orderId) {
				// Something was made and taken from stock: that is a void, with its own permission.
				if (!membership.permissions.includes(Permission.ORDERS_CANCEL))
					throw new ForbiddenException("You are not allowed to cancel orders");
				await this.orders.reverseInTransaction(
					manager,
					membership,
					session.orderId,
					dto,
					OrderStatus.CANCELLED,
					AuditAction.ORDER_CANCELLED,
					{ tab: true }
				);
			}
			await this.finish(manager, session, TableSessionStatus.CANCELLED);
			await this.announce(manager, session, ["tables"]);
		});
		await this.cacheService.bump(CacheKeys.dashboardVersion(membership.businessId));
		return { cancelled: true };
	}

	/** Staff have heard the guest's call (or brought the bill): the table stops asking. */
	async dismissCall(
		membership: ResolvedMembership,
		tableId: string
	): Promise<TableResponse> {
		const table = await this.loadTable(membership, tableId);
		await this.dataSource.transaction(async (manager) => {
			await manager.update(
				DiningTable,
				{ id: table.id },
				{ callKind: null, calledAt: null }
			);
			await this.realtime.publish(manager, {
				topic: "tables",
				businessId: table.businessId,
				branchId: table.branchId,
			});
		});
		return toTableResponse({
			...table,
			callKind: null,
			calledAt: null,
		} as DiningTable);
	}

	// ------------------------------------------------------------ internals

	/**
	 * Adds one round to the tab's order — creating the order with the first round — and
	 * sends the kitchen the new lines. Runs under the session's row lock.
	 */
	private async appendRound(
		manager: EntityManager,
		membership: ResolvedMembership,
		session: TableSession,
		lines: TableRequestLine[]
	): Promise<void> {
		const business = await manager.findOneOrFail(Business, {
			where: { id: session.businessId },
		});
		const priced = await this.orders.priceLines(manager, business.id, lines);
		const usage = await this.orders.takeStock(manager, business.id, priced);

		let order: Order;
		let round = 1;
		if (!session.orderId) {
			const [member, table] = await Promise.all([
				manager.findOneOrFail(BusinessMember, {
					where: { id: membership.memberId },
				}),
				manager.findOneOrFail(DiningTable, {
					where: { id: session.tableId },
					withDeleted: true,
				}),
			]);
			const number = await this.orders.allocateNumber(manager, business);
			order = await manager.save(
				manager.create(Order, {
					businessId: business.id,
					branchId: session.branchId,
					memberId: member.id,
					employeeName: member.displayName,
					customerId: null,
					customerName: null,
					serviceType: ServiceType.DINE_IN,
					label: table.name,
					number,
					// One order per tab, so the tab's id is a natural idempotency key.
					clientOrderId: session.id,
					status: OrderStatus.PENDING_PAYMENT,
					kitchenStatus: null,
					kitchenUpdatedAt: null,
					subtotal: 0,
					discount: 0,
					vat: 0,
					total: 0,
					totalCost: 0,
					ingredientUsage: null,
					vatBasisPoints: business.vatBasisPoints,
					pricesIncludeVat: business.pricesIncludeVat,
					paidAt: null,
					tableSessionId: session.id,
				})
			);
			await manager.update(TableSession, { id: session.id }, { orderId: order.id });
		} else {
			order = await manager
				.getRepository(Order)
				.createQueryBuilder("ord")
				.setLock("pessimistic_write")
				.where("ord.id = :id", { id: session.orderId })
				.getOneOrFail();
			const last = (await manager
				.getRepository(OrderItem)
				.createQueryBuilder("item")
				.select("COALESCE(MAX(item.round), 0)::int", "max")
				.where("item.order_id = :id", { id: order.id })
				.getRawOne()) as { max: number } | undefined;
			round = (last?.max ?? 0) + 1;
		}

		await manager.save(
			priced.map((item) =>
				Object.assign(this.orders.toOrderItem(manager, item, 0, round), {
					orderId: order.id,
				})
			)
		);

		const all = await manager.find(OrderItem, { where: { orderId: order.id } });
		const totals = computeOrderTotals(
			all,
			0,
			order.vatBasisPoints,
			order.pricesIncludeVat
		);
		const cooks = priced.some((i) => i.toKitchen);
		await manager.update(
			Order,
			{ id: order.id },
			{
				...totals,
				ingredientUsage: mergeUsage(order.ingredientUsage, usage),
				// A new round sends the ticket back to the top of the kitchen's queue.
				...(cooks
					? { kitchenStatus: KitchenStatus.NEW, kitchenUpdatedAt: new Date() }
					: {}),
			}
		);
		await this.announce(
			manager,
			session,
			cooks ? ["tables", "orders", "kitchen"] : ["tables", "orders"]
		);
	}

	/** Closing or cancelling: the table is freed and guests' unanswered rounds are turned down. */
	private async finish(
		manager: EntityManager,
		session: TableSession,
		status: TableSessionStatus
	): Promise<void> {
		await manager.update(
			TableSession,
			{ id: session.id },
			{ status, closedAt: new Date() }
		);
		await manager.update(
			TableRequest,
			{ sessionId: session.id, status: TableRequestStatus.PENDING },
			{ status: TableRequestStatus.REJECTED, handledAt: new Date() }
		);
		// The party has gone: whatever they called for is answered.
		await manager.update(
			DiningTable,
			{ id: session.tableId },
			{ callKind: null, calledAt: null }
		);
	}

	private async announce(
		manager: EntityManager,
		session: TableSession,
		topics: ("tables" | "orders" | "kitchen")[]
	): Promise<void> {
		for (const topic of topics) {
			await this.realtime.publish(manager, {
				topic,
				businessId: session.businessId,
				branchId: session.branchId,
			});
		}
	}

	/** Each request's lines with today's names and prices, for staff to judge before accepting. */
	async describeRequests(
		businessId: string,
		requests: TableRequest[]
	): Promise<TableRequestResponse[]> {
		const productIds = [
			...new Set(requests.flatMap((r) => r.items.map((i) => i.productId))),
		];
		const products = productIds.length
			? await this.dataSource.getRepository(Product).find({
					where: { id: In(productIds), businessId },
					relations: { modifierGroups: { options: true } },
					withDeleted: true,
				})
			: [];
		const byId = new Map(products.map((p) => [p.id, p]));
		return requests.map((request) => {
			const items = request.items.map((line) => {
				const product = byId.get(line.productId);
				const options = (product?.modifierGroups ?? [])
					.flatMap((g) => g.options)
					.filter((o) => line.modifierOptionIds.includes(o.id));
				return {
					productId: line.productId,
					name: product?.name ?? "—",
					quantity: line.quantity,
					unitPrice: Money.add(
						product?.price ?? 0,
						...options.map((o) => o.priceDelta)
					),
					modifiers: options.map((o) => o.name),
					note: line.note,
				};
			});
			return {
				id: request.id,
				status: request.status,
				createdAt: request.createdAt.toISOString(),
				items,
				total: Money.add(
					...items.map((i) => Money.multiply(i.unitPrice, i.quantity))
				),
			};
		});
	}

	private async loadOrder(orderId: string): Promise<Order | null> {
		return this.dataSource.getRepository(Order).findOne({
			where: { id: orderId },
			relations: { items: { modifiers: true } },
		});
	}

	private async saveTable(table: DiningTable): Promise<DiningTable> {
		try {
			return await this.dataSource.getRepository(DiningTable).save(table);
		} catch (error) {
			if (isUniqueViolation(error))
				throw new ConflictException("A table with this name already exists");
			throw error;
		}
	}

	private async loadTable(
		membership: ResolvedMembership,
		id: string
	): Promise<DiningTable> {
		const table = await this.dataSource.getRepository(DiningTable).findOne({
			where: { id, businessId: membership.businessId },
		});
		if (!table || !canSeeBranch(membership, table.branchId))
			throw new NotFoundException("Table not found");
		return table;
	}

	private openSession(manager: EntityManager, tableId: string) {
		return manager.findOne(TableSession, {
			where: { tableId, status: TableSessionStatus.OPEN },
		});
	}

	private async loadSession(
		manager: EntityManager,
		membership: ResolvedMembership,
		id: string
	): Promise<TableSession> {
		const session = await manager.findOne(TableSession, {
			where: { id, businessId: membership.businessId },
		});
		if (!session || !canSeeBranch(membership, session.branchId))
			throw new NotFoundException("Tab not found");
		return session;
	}

	/** The open tab under a row lock: rounds, check-out and cancel queue on it. */
	private async lockOpenSession(
		manager: EntityManager,
		membership: ResolvedMembership,
		id: string
	): Promise<TableSession> {
		const session = await manager
			.getRepository(TableSession)
			.createQueryBuilder("s")
			.setLock("pessimistic_write")
			.where("s.id = :id AND s.business_id = :businessId", {
				id,
				businessId: membership.businessId,
			})
			.getOne();
		if (!session || !canSeeBranch(membership, session.branchId))
			throw new NotFoundException("Tab not found");
		if (session.status !== TableSessionStatus.OPEN)
			throw new ConflictException("This tab is already closed");
		return session;
	}

	private async lockPendingRequest(
		manager: EntityManager,
		membership: ResolvedMembership,
		id: string
	): Promise<TableRequest> {
		const request = await manager
			.getRepository(TableRequest)
			.createQueryBuilder("r")
			.setLock("pessimistic_write")
			.where("r.id = :id AND r.business_id = :businessId", {
				id,
				businessId: membership.businessId,
			})
			.getOne();
		if (!request || !canSeeBranch(membership, request.branchId))
			throw new NotFoundException("Request not found");
		if (request.status !== TableRequestStatus.PENDING)
			throw new ConflictException(
				`Request is already ${request.status.toLowerCase()}`
			);
		return request;
	}

	private async resolveBranch(
		membership: ResolvedMembership,
		branchId?: string
	): Promise<Branch> {
		const branch = await this.dataSource.getRepository(Branch).findOne({
			where: branchId
				? { id: branchId, businessId: membership.businessId, isActive: true }
				: { businessId: membership.businessId, isDefault: true },
		});
		if (!branch || !canSeeBranch(membership, branch.id))
			throw new NotFoundException("Branch not found");
		return branch;
	}
}

const canSeeBranch = (membership: ResolvedMembership, branchId: string) =>
	membership.branchIds === null || membership.branchIds.includes(branchId);

export const toRequestLine = (item: {
	productId: string;
	quantity: number;
	modifierOptionIds?: string[];
	note?: string;
}): TableRequestLine => ({
	productId: item.productId,
	quantity: item.quantity,
	modifierOptionIds: item.modifierOptionIds ?? [],
	note: item.note?.trim() || null,
});

export const sortedItems = (order: Order | null): OrderItem[] =>
	[...(order?.items ?? [])].sort(
		(a, b) => a.round - b.round || a.createdAt.getTime() - b.createdAt.getTime()
	);

const toTableResponse = (table: DiningTable): TableResponse => ({
	id: table.id,
	branchId: table.branchId,
	name: table.name,
	zone: table.zone,
	seats: table.seats,
	displayOrder: table.displayOrder,
	isActive: table.isActive,
	qrToken: table.qrToken,
	call:
		table.callKind && table.calledAt
			? { kind: table.callKind, at: table.calledAt.toISOString() }
			: null,
});
