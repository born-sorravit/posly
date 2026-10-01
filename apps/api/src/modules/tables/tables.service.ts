import { Branch } from "@/models/branches/entities/branch.entity";
import { BusinessMember } from "@/models/businesses/entities/business-member.entity";
import { Business } from "@/models/businesses/entities/business.entity";
import { Product } from "@/models/catalog/entities/product.entity";
import { OrderItem } from "@/models/orders/entities/order-item.entity";
import { OrderItemModifier } from "@/models/orders/entities/order-item-modifier.entity";
import { Order } from "@/models/orders/entities/order.entity";
import { Payment } from "@/models/orders/entities/payment.entity";
import { DiningTable } from "@/models/tables/entities/dining-table.entity";
import {
	TableRequest,
	type TableRequestLine,
} from "@/models/tables/entities/table-request.entity";
import { TableSession } from "@/models/tables/entities/table-session.entity";
import { OrderResponse } from "@/modules/orders/dto/order.dto";
import { InventoryService } from "@/modules/inventory/inventory.service";
import { OrdersService } from "@/modules/orders/orders.service";
import { allocateDiscount, computeOrderTotals } from "@/modules/orders/pricing";
import { RealtimeService } from "@/modules/realtime/realtime.service";
import { EntitlementsService } from "@/modules/subscriptions/entitlements.service";
import {
	AddRoundDto,
	MergeTabDto,
	MoveTabDto,
	SplitTabDto,
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
import {
	CALL_RANK,
	TableRequestStatus,
	TableSessionStatus,
} from "@/shared/enums/table.enum";
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
		private readonly entitlements: EntitlementsService,
		private readonly inventory: InventoryService
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

	/**
	 * Moves the whole tab to a free table in the same branch: its lines, waiting rounds and
	 * any call the guests made. The ticket and receipt take the new table's name.
	 */
	async move(
		membership: ResolvedMembership,
		sessionId: string,
		dto: MoveTabDto
	): Promise<TabResponse> {
		try {
			await this.dataSource.transaction(async (manager) => {
				const session = await this.lockOpenSession(manager, membership, sessionId);
				if (session.tableId === dto.tableId)
					throw new ConflictException("The tab is already at this table");
				const target = await manager
					.getRepository(DiningTable)
					.createQueryBuilder("t")
					.setLock("pessimistic_write")
					.where("t.id = :id AND t.business_id = :businessId", {
						id: dto.tableId,
						businessId: session.businessId,
					})
					.getOne();
				if (!target || target.branchId !== session.branchId)
					throw new NotFoundException("Table not found");
				if (!target.isActive)
					throw new ConflictException("This table is turned off");
				const source = await manager.findOneOrFail(DiningTable, {
					where: { id: session.tableId },
					withDeleted: true,
				});

				// The partial unique index refuses it if the target has a tab of its own.
				await manager.update(
					TableSession,
					{ id: session.id },
					{ tableId: target.id }
				);
				if (session.orderId)
					await manager.update(
						Order,
						{ id: session.orderId },
						{ label: target.name }
					);
				await this.carryCall(manager, source, target);
				await this.announce(manager, session, ["tables", "orders", "kitchen"]);
			});
		} catch (error) {
			if (isUniqueViolation(error))
				throw new ConflictException("That table already has a tab open");
			throw error;
		}
		return this.tab(membership, sessionId);
	}

	/**
	 * Brings another open tab's lines onto this one, and frees that table. Nothing goes back
	 * to stock — the lines only change bills — and the other tab's order, left empty, is
	 * cancelled at nothing.
	 */
	async merge(
		membership: ResolvedMembership,
		sessionId: string,
		dto: MergeTabDto
	): Promise<TabResponse> {
		if (sessionId === dto.sessionId)
			throw new BadRequestException("Choose another table to merge");
		await this.dataSource.transaction(async (manager) => {
			// Both tabs, then both orders, always in id order: two staff merging each way at
			// once must queue, not deadlock.
			const locked = new Map<string, TableSession>();
			for (const id of [sessionId, dto.sessionId].sort())
				locked.set(id, await this.lockOpenSession(manager, membership, id));
			const target = locked.get(sessionId) as TableSession;
			const source = locked.get(dto.sessionId) as TableSession;
			if (target.branchId !== source.branchId)
				throw new ConflictException("Those tables are in different branches");

			const orders = new Map<string, Order>();
			for (const id of [target.orderId, source.orderId]
				.filter((o): o is string => o !== null)
				.sort()) {
				orders.set(
					id,
					await manager
						.getRepository(Order)
						.createQueryBuilder("ord")
						.setLock("pessimistic_write")
						.where("ord.id = :id", { id })
						.getOneOrFail()
				);
			}
			const targetTable = await manager.findOneOrFail(DiningTable, {
				where: { id: target.tableId },
				withDeleted: true,
			});
			const sourceTable = await manager.findOneOrFail(DiningTable, {
				where: { id: source.tableId },
				withDeleted: true,
			});

			// Rounds still waiting for staff follow the guests to this tab.
			await manager.update(
				TableRequest,
				{ sessionId: source.id, status: TableRequestStatus.PENDING },
				{ sessionId: target.id }
			);

			const targetOrder = target.orderId ? orders.get(target.orderId) : undefined;
			const sourceOrder = source.orderId ? orders.get(source.orderId) : undefined;
			if (sourceOrder && !targetOrder) {
				await manager.update(
					Order,
					{ id: sourceOrder.id },
					{ tableSessionId: target.id, label: targetTable.name }
				);
				await manager.update(
					TableSession,
					{ id: target.id },
					{ orderId: sourceOrder.id }
				);
				await manager.update(TableSession, { id: source.id }, { orderId: null });
			} else if (sourceOrder && targetOrder) {
				const last = (await manager
					.getRepository(OrderItem)
					.createQueryBuilder("item")
					.select("COALESCE(MAX(item.round), 0)::int", "max")
					.where("item.order_id = :id", { id: targetOrder.id })
					.getRawOne()) as { max: number } | undefined;
				// The other table's rounds follow this one's, in the order they came.
				await manager.query(
					`UPDATE order_item SET order_id = $1, round = round + $2 WHERE order_id = $3`,
					[targetOrder.id, last?.max ?? 0, sourceOrder.id]
				);
				const items = await manager.find(OrderItem, {
					where: { orderId: targetOrder.id },
				});
				await manager.update(
					Order,
					{ id: targetOrder.id },
					{
						...computeOrderTotals(
							items,
							0,
							targetOrder.vatBasisPoints,
							targetOrder.pricesIncludeVat
						),
						ingredientUsage: mergeUsage(
							targetOrder.ingredientUsage,
							sourceOrder.ingredientUsage
						),
						...mergedKitchen(targetOrder, sourceOrder),
					}
				);
				await manager.update(
					Order,
					{ id: sourceOrder.id },
					{
						status: OrderStatus.CANCELLED,
						subtotal: 0,
						discount: 0,
						vat: 0,
						total: 0,
						totalCost: 0,
						ingredientUsage: null,
						kitchenStatus: null,
					}
				);
			}

			const guests = (target.guests ?? 0) + (source.guests ?? 0);
			await manager.update(
				TableSession,
				{ id: target.id },
				{ guests: guests || null }
			);
			await this.carryCall(manager, sourceTable, targetTable);
			await this.finish(manager, source, TableSessionStatus.CLOSED);
			await this.announce(manager, target, ["tables", "orders", "kitchen"]);
		});
		await this.cacheService.bump(CacheKeys.dashboardVersion(membership.businessId));
		return this.tab(membership, sessionId);
	}

	/**
	 * Pays part of the tab now: the chosen lines (or part of a line's quantity) become their
	 * own paid order, with their share of what the tab took from ingredient stock. What is
	 * left stays on the tab. Idempotent on `clientOrderId`, like a checkout.
	 */
	async split(
		membership: ResolvedMembership,
		sessionId: string,
		dto: SplitTabDto
	): Promise<OrderResponse> {
		if (
			(dto.discount ?? 0) > 0 &&
			!membership.permissions.includes(Permission.ORDERS_DISCOUNT)
		) {
			throw new ForbiddenException("You are not allowed to give discounts");
		}
		const existing = await this.dataSource.getRepository(Order).findOne({
			where: { businessId: membership.businessId, clientOrderId: dto.clientOrderId },
			select: { id: true },
		});
		if (existing) return this.orders.findOne(membership, existing.id);

		let orderId: string;
		try {
			orderId = await this.dataSource.transaction((manager) =>
				this.splitInTransaction(manager, membership, sessionId, dto)
			);
		} catch (error) {
			if (isUniqueViolation(error)) {
				const winner = await this.dataSource.getRepository(Order).findOne({
					where: {
						businessId: membership.businessId,
						clientOrderId: dto.clientOrderId,
					},
					select: { id: true },
				});
				if (winner) return this.orders.findOne(membership, winner.id);
			}
			throw error;
		}
		await this.cacheService.bump(CacheKeys.dashboardVersion(membership.businessId));
		return this.orders.findOne(membership, orderId);
	}

	private async splitInTransaction(
		manager: EntityManager,
		membership: ResolvedMembership,
		sessionId: string,
		dto: SplitTabDto
	): Promise<string> {
		const session = await this.lockOpenSession(manager, membership, sessionId);
		if (!session.orderId) throw new ConflictException("Nothing on this tab yet");
		const tab = await manager
			.getRepository(Order)
			.createQueryBuilder("ord")
			.setLock("pessimistic_write")
			.where("ord.id = :id", { id: session.orderId })
			.getOneOrFail();
		const items = await manager.find(OrderItem, {
			where: { orderId: tab.id },
			relations: { modifiers: true },
		});
		const byId = new Map(items.map((i) => [i.id, i]));

		const wanted = new Map<string, number>();
		for (const line of dto.items)
			wanted.set(line.itemId, (wanted.get(line.itemId) ?? 0) + line.quantity);
		const picked = [...wanted.entries()].map(([itemId, quantity]) => {
			const item = byId.get(itemId);
			if (!item) throw new NotFoundException("Line not found on this tab");
			if (quantity > item.quantity)
				throw new BadRequestException(
					`Only ${item.quantity} of ${item.name} on the tab`
				);
			return { item, quantity };
		});
		const left =
			items.reduce((n, i) => n + i.quantity, 0) -
			picked.reduce((n, p) => n + p.quantity, 0);
		if (left <= 0) throw new ConflictException("Use check-out to pay the whole tab");

		const lines = picked.map(({ item, quantity }) => ({
			unitPrice: item.unitPrice,
			unitCost: item.unitCost,
			quantity,
		}));
		// The tab's own VAT settings: the ones its lines were priced under.
		const totals = computeOrderTotals(
			lines,
			dto.discount ?? 0,
			tab.vatBasisPoints,
			tab.pricesIncludeVat
		);
		const shares = allocateDiscount(
			lines.map((l) => Money.multiply(l.unitPrice, l.quantity)),
			totals.discount
		);
		const cash = dto.payment.method === PaymentMethod.CASH;
		const received = cash ? (dto.payment.received ?? totals.total) : null;
		if (received !== null && received < totals.total) {
			throw new BadRequestException("Cash received is less than the total");
		}

		// What these lines took from ingredient stock, by today's recipes — never more than
		// the tab holds, in case a recipe grew since the round was accepted.
		const estimate =
			(await this.inventory.usageOf(
				manager,
				picked
					.filter((p) => p.item.productId)
					.map(({ item, quantity }) => ({
						productId: item.productId as string,
						optionIds: (item.modifiers ?? [])
							.map((m) => m.optionId)
							.filter((o): o is string => Boolean(o)),
						quantity,
					}))
			)) ?? {};
		const tabUsage = tab.ingredientUsage ?? {};
		const splitUsage: Record<string, number> = {};
		const remainingUsage: Record<string, number> = { ...tabUsage };
		for (const [id, amount] of Object.entries(estimate)) {
			const taken = Math.min(amount, tabUsage[id] ?? 0);
			if (taken <= 0) continue;
			splitUsage[id] = taken;
			const rest = Math.round(((tabUsage[id] ?? 0) - taken) * 1000) / 1000;
			if (rest > 0) remainingUsage[id] = rest;
			else delete remainingUsage[id];
		}

		// Lines still cooking stay on the kitchen screen after they are paid.
		const kitchenLines = picked.filter((p) => p.item.toKitchen);
		const kitchenStatus =
			kitchenLines.length === 0
				? null
				: kitchenLines.some((p) => p.item.preparedAt === null)
					? (tab.kitchenStatus ?? KitchenStatus.NEW)
					: KitchenStatus.SERVED;

		const business = await manager.findOneOrFail(Business, {
			where: { id: tab.businessId },
		});
		const member = await manager.findOneOrFail(BusinessMember, {
			where: { id: membership.memberId },
		});
		const number = await this.orders.allocateNumber(manager, business);
		const now = new Date();
		const paid = await manager.save(
			manager.create(Order, {
				businessId: tab.businessId,
				branchId: tab.branchId,
				memberId: member.id,
				employeeName: member.displayName,
				customerId: null,
				customerName: null,
				serviceType: tab.serviceType,
				label: tab.label,
				number,
				clientOrderId: dto.clientOrderId,
				status: OrderStatus.PAID,
				kitchenStatus,
				kitchenUpdatedAt: kitchenStatus ? (tab.kitchenUpdatedAt ?? now) : null,
				...totals,
				ingredientUsage: Object.keys(splitUsage).length ? splitUsage : null,
				vatBasisPoints: tab.vatBasisPoints,
				pricesIncludeVat: tab.pricesIncludeVat,
				paidAt: now,
				tableSessionId: session.id,
				payments: [
					manager.create(Payment, {
						businessId: tab.businessId,
						method: dto.payment.method,
						status: PaymentStatus.SUCCESS,
						amount: totals.total,
						received,
						change:
							received === null ? null : Money.subtract(received, totals.total),
						reference: null,
					}),
				],
			})
		);

		for (const [index, { item, quantity }] of picked.entries()) {
			if (quantity === item.quantity) {
				await manager.update(
					OrderItem,
					{ id: item.id },
					{ orderId: paid.id, discount: shares[index] }
				);
				continue;
			}
			// Part of a line: the tab keeps the rest, the paid order gets a copy of the snapshot.
			await manager.update(
				OrderItem,
				{ id: item.id },
				{
					quantity: item.quantity - quantity,
					lineTotal: Money.multiply(item.unitPrice, item.quantity - quantity),
				}
			);
			await manager.save(
				manager.create(OrderItem, {
					orderId: paid.id,
					productId: item.productId,
					name: item.name,
					art: item.art,
					quantity,
					unitPrice: item.unitPrice,
					unitCost: item.unitCost,
					costMissing: item.costMissing,
					lineTotal: Money.multiply(item.unitPrice, quantity),
					discount: shares[index],
					note: item.note,
					toKitchen: item.toKitchen,
					preparedAt: item.preparedAt,
					round: item.round,
					modifiers: (item.modifiers ?? []).map((m) =>
						manager.create(OrderItemModifier, {
							optionId: m.optionId,
							groupName: m.groupName,
							optionName: m.optionName,
							priceDelta: m.priceDelta,
							costDelta: m.costDelta,
						})
					),
				})
			);
		}

		const remaining = await manager.find(OrderItem, { where: { orderId: tab.id } });
		await manager.update(
			Order,
			{ id: tab.id },
			{
				...computeOrderTotals(
					remaining,
					0,
					tab.vatBasisPoints,
					tab.pricesIncludeVat
				),
				ingredientUsage: Object.keys(remainingUsage).length ? remainingUsage : null,
			}
		);
		await this.announce(manager, session, ["tables", "orders", "kitchen"]);
		return paid.id;
	}

	/** A call follows the guests to their new table; the one nearer to settling up wins. */
	private async carryCall(
		manager: EntityManager,
		from: DiningTable,
		to: DiningTable
	): Promise<void> {
		const pick =
			from.callKind &&
			(!to.callKind || CALL_RANK[from.callKind] > CALL_RANK[to.callKind])
				? { callKind: from.callKind, calledAt: from.calledAt }
				: { callKind: to.callKind, calledAt: to.calledAt };
		await manager.update(DiningTable, { id: to.id }, pick);
		await manager.update(
			DiningTable,
			{ id: from.id },
			{ callKind: null, calledAt: null }
		);
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

const KITCHEN_ORDER: KitchenStatus[] = [
	KitchenStatus.NEW,
	KitchenStatus.PREPARING,
	KitchenStatus.READY,
	KitchenStatus.SERVED,
];

/** Two tickets become one: the less advanced status, the later of their times. */
const mergedKitchen = (a: Order, b: Order) => {
	const statuses = [a.kitchenStatus, b.kitchenStatus].filter(
		(s): s is KitchenStatus => s !== null
	);
	if (!statuses.length) return {};
	const kitchenStatus = statuses.sort(
		(x, y) => KITCHEN_ORDER.indexOf(x) - KITCHEN_ORDER.indexOf(y)
	)[0];
	const times = [a.kitchenUpdatedAt, b.kitchenUpdatedAt].filter(
		(t): t is Date => t !== null
	);
	return {
		kitchenStatus,
		kitchenUpdatedAt: times.length
			? new Date(Math.max(...times.map((t) => t.getTime())))
			: new Date(),
	};
};
