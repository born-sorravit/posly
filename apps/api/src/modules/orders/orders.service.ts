import { AuditLog } from "@/models/audit/entities/audit-log.entity";
import { CacheKeys } from "@/shared/cache/cache-keys";
import { CacheService } from "@/shared/cache/cache.service";
import { AuditLogRepository } from "@/models/audit/audit-log.repository";
import { Branch } from "@/models/branches/entities/branch.entity";
import { BusinessMember } from "@/models/businesses/entities/business-member.entity";
import { Business } from "@/models/businesses/entities/business.entity";
import { Category } from "@/models/catalog/entities/category.entity";
import { Product } from "@/models/catalog/entities/product.entity";
import { Order } from "@/models/orders/entities/order.entity";
import { OrderItem } from "@/models/orders/entities/order-item.entity";
import { OrderItemModifier } from "@/models/orders/entities/order-item-modifier.entity";
import { Payment } from "@/models/orders/entities/payment.entity";
import { OrderRepository } from "@/models/orders/order.repository";
import {
	CheckoutDto,
	OrderResponse,
	QueryOrdersDto,
	ReverseOrderDto,
} from "@/modules/orders/dto/order.dto";
import { InventoryService } from "@/modules/inventory/inventory.service";
import { allocateDiscount, computeOrderTotals } from "@/modules/orders/pricing";
import { Customer } from "@/models/customers/entities/customer.entity";
import { Feature } from "@/shared/enums/subscription.enum";
import { EntitlementsService } from "@/modules/subscriptions/entitlements.service";
import { NotificationsService } from "@/modules/notifications/notifications.service";
import { RealtimeService } from "@/modules/realtime/realtime.service";
import { NotificationKind } from "@/shared/enums/notification.enum";
import type { ResolvedMembership } from "@/shared/decorators/current-membership.decorator";
import { AuditAction } from "@/shared/enums/audit-action.enum";
import {
	KitchenStatus,
	ModifierSelection,
	OrderStatus,
	PaymentMethod,
	PaymentStatus,
} from "@/shared/enums/order.enum";
import { Permission } from "@/shared/enums/permission.enum";
import { Money } from "@/shared/utils/money.util";
import { OrderDirection } from "@/shared/dto/pagination.dto";
import { PaginatedResponse, paginate } from "@/shared/utils/pagination.util";
import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { DataSource, EntityManager, In } from "typeorm";

/** One line as asked for: ids and quantities only, never a price. */
export interface LineInput {
	productId: string;
	quantity: number;
	modifierOptionIds?: string[];
	note?: string | null;
}

export interface PricedItem {
	product: Product;
	quantity: number;
	note: string | null;
	unitPrice: number;
	unitCost: number;
	costMissing: boolean;
	modifiers: {
		optionId: string;
		groupName: string;
		optionName: string;
		priceDelta: number;
		costDelta: number;
	}[];
	toKitchen: boolean;
}

const ORDER_RELATIONS = { items: { modifiers: true }, payments: true } as const;

const isUniqueViolation = (error: unknown): boolean =>
	typeof error === "object" &&
	error !== null &&
	"code" in error &&
	error.code === "23505";

@Injectable()
export class OrdersService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly orderRepository: OrderRepository,
		private readonly auditLogRepository: AuditLogRepository,
		private readonly entitlements: EntitlementsService,
		private readonly notifications: NotificationsService,
		private readonly realtime: RealtimeService,
		private readonly cacheService: CacheService,
		private readonly inventory: InventoryService
	) {}

	/**
	 * Rings up a sale in one transaction: order, items, modifier snapshots, payment, stock.
	 *
	 * The request carries ids and quantities only. Prices, VAT, totals and change are all
	 * computed here from this business's own rows — a product id from another shop is simply
	 * "not found", and a doctored price has nowhere to go.
	 *
	 * Idempotent on `clientOrderId`: a double tap or a retry after a dropped response returns
	 * the order that already exists instead of charging twice. That same key is what an
	 * offline sync queue will replay later.
	 */
	async checkout(
		membership: ResolvedMembership,
		dto: CheckoutDto
	): Promise<OrderResponse> {
		const existing = await this.findByClientId(
			membership.businessId,
			dto.clientOrderId
		);
		if (existing) return existing;

		try {
			const orderId = await this.dataSource.transaction((manager) =>
				this.createInTransaction(manager, membership, dto)
			);
			// After the commit, so a dashboard read cannot re-cache the pre-sale figures.
			await this.cacheService.bump(
				CacheKeys.dashboardVersion(membership.businessId)
			);
			return this.findOne(membership, orderId);
		} catch (error) {
			// Two identical requests raced past the check above; the loser returns the winner.
			if (isUniqueViolation(error)) {
				const winner = await this.findByClientId(
					membership.businessId,
					dto.clientOrderId
				);
				if (winner) return winner;
			}
			throw error;
		}
	}

	private async createInTransaction(
		manager: EntityManager,
		membership: ResolvedMembership,
		dto: CheckoutDto
	): Promise<string> {
		// Discounts move money out of the till, so they need their own permission — a cashier
		// without it can only charge full price, whatever the client sends.
		if (
			(dto.discount ?? 0) > 0 &&
			!membership.permissions.includes(Permission.ORDERS_DISCOUNT)
		) {
			throw new ForbiddenException("You are not allowed to give discounts");
		}

		const business = await manager.findOneOrFail(Business, {
			where: { id: membership.businessId },
		});
		const branch = await this.resolveBranch(manager, membership, dto.branchId);
		const customer = dto.customerId
			? await this.resolveCustomer(manager, membership, dto.customerId)
			: null;
		const member = await manager.findOneOrFail(BusinessMember, {
			where: { id: membership.memberId },
		});

		const items = await this.priceLines(manager, business.id, dto.items);

		const totals = computeOrderTotals(
			items,
			dto.discount ?? 0,
			business.vatBasisPoints,
			business.pricesIncludeVat
		);

		const lineDiscounts = allocateDiscount(
			items.map((i) => Money.multiply(i.unitPrice, i.quantity)),
			totals.discount
		);

		const cash = dto.payment.method === PaymentMethod.CASH;
		const received = cash ? (dto.payment.received ?? totals.total) : null;
		if (received !== null && received < totals.total) {
			throw new BadRequestException("Cash received is less than the total");
		}

		const ingredientUsage = await this.takeStock(manager, business.id, items);
		const number = await this.allocateNumber(manager, business);

		const now = new Date();
		const order = manager.create(Order, {
			businessId: business.id,
			branchId: branch.id,
			memberId: member.id,
			employeeName: member.displayName,
			customerId: customer?.id ?? null,
			customerName: customer?.name ?? null,
			serviceType: dto.serviceType ?? null,
			label: dto.label || null,
			number,
			clientOrderId: dto.clientOrderId,
			status: OrderStatus.PAID,
			kitchenStatus: items.some((i) => i.toKitchen) ? KitchenStatus.NEW : null,
			kitchenUpdatedAt: items.some((i) => i.toKitchen) ? now : null,
			...totals,
			ingredientUsage,
			vatBasisPoints: business.vatBasisPoints,
			pricesIncludeVat: business.pricesIncludeVat,
			paidAt: now,
			items: items.map((item, index) =>
				this.toOrderItem(manager, item, lineDiscounts[index], 1)
			),
			payments: [
				manager.create(Payment, {
					businessId: business.id,
					method: dto.payment.method,
					status: PaymentStatus.SUCCESS,
					amount: totals.total,
					received,
					change: received === null ? null : Money.subtract(received, totals.total),
					reference: null,
				}),
			],
		});

		const saved = await manager.save(order);
		// Delivered on commit: the dashboard, the orders list and the kitchen refresh at once.
		await this.realtime.publish(manager, {
			topic: "orders",
			businessId: business.id,
			branchId: branch.id,
		});
		if (saved.kitchenStatus) {
			await this.realtime.publish(manager, {
				topic: "kitchen",
				businessId: business.id,
				branchId: branch.id,
			});
		}
		return saved.id;
	}

	/**
	 * Options must belong to groups actually attached to this product; SINGLE groups take at
	 * most one; required groups must be answered.
	 */
	private resolveModifiers(product: Product, optionIds: string[]) {
		const groups = product.modifierGroups ?? [];
		const picked = new Set(optionIds);
		const chosen: {
			optionId: string;
			groupName: string;
			optionName: string;
			priceDelta: number;
			costDelta: number;
		}[] = [];
		let matched = 0;

		for (const group of groups) {
			const inGroup = group.options.filter((o) => picked.has(o.id));
			matched += inGroup.length;

			if (group.selection === ModifierSelection.SINGLE && inGroup.length > 1) {
				throw new BadRequestException(`Choose one option for ${group.name}`);
			}
			if (group.required && inGroup.length === 0) {
				throw new BadRequestException(
					`${group.name} is required for ${product.name}`
				);
			}
			for (const option of inGroup) {
				chosen.push({
					optionId: option.id,
					groupName: group.name,
					optionName: option.name,
					priceDelta: option.priceDelta,
					costDelta: option.costDelta,
				});
			}
		}

		if (matched !== picked.size) {
			throw new BadRequestException(`Unknown option for ${product.name}`);
		}
		return chosen;
	}

	// ------------------------------------------------- shared with table tabs

	/**
	 * Prices what was asked for from this business's own active products: snapshots of
	 * price, cost and modifiers, and whether each line goes to the kitchen. A product id from
	 * another shop, or an inactive one, is "not found".
	 */
	async priceLines(
		manager: EntityManager,
		businessId: string,
		lines: LineInput[]
	): Promise<PricedItem[]> {
		const productIds = [...new Set(lines.map((i) => i.productId))];
		const products = await manager.find(Product, {
			where: { id: In(productIds), businessId, isActive: true },
			relations: { modifierGroups: { options: true } },
		});
		const byId = new Map(products.map((p) => [p.id, p]));
		// Which categories cook: lines from the rest never reach the kitchen screen.
		const categoryIds = [
			...new Set(
				products.map((p) => p.categoryId).filter((c): c is string => Boolean(c))
			),
		];
		const kitchenCategories = new Set(
			categoryIds.length === 0
				? []
				: (
						await manager.find(Category, {
							where: { id: In(categoryIds), sendToKitchen: true },
							select: { id: true },
							withDeleted: true,
						})
					).map((c) => c.id)
		);

		return lines.map((line) => {
			const product = byId.get(line.productId);
			if (!product) throw new NotFoundException("Product not found");

			const chosen = this.resolveModifiers(product, line.modifierOptionIds ?? []);
			return {
				product,
				quantity: line.quantity,
				note: line.note?.trim() || null,
				unitPrice: Money.add(product.price, ...chosen.map((c) => c.priceDelta)),
				unitCost: Money.add(product.cost ?? 0, ...chosen.map((c) => c.costDelta)),
				costMissing: product.cost === null,
				modifiers: chosen,
				// Uncategorised products are assumed to be made to order, like the default category.
				toKitchen: !product.categoryId || kitchenCategories.has(product.categoryId),
			};
		});
	}

	/**
	 * Decrements tracked products, refusing to sell what is not there, then takes what the
	 * recipes use from ingredients (never refusing). Returns the ingredient usage to keep.
	 */
	async takeStock(
		manager: EntityManager,
		businessId: string,
		items: PricedItem[]
	): Promise<Record<string, number> | null> {
		const needed = new Map<string, { product: Product; quantity: number }>();
		for (const item of items) {
			if (item.product.trackStock) {
				const entry = needed.get(item.product.id);
				needed.set(item.product.id, {
					product: item.product,
					quantity: (entry?.quantity ?? 0) + item.quantity,
				});
			}
		}
		for (const [productId, { product, quantity }] of needed) {
			const result = await manager
				.createQueryBuilder()
				.update(Product)
				.set({ stock: () => `stock - ${quantity}` })
				.where("id = :productId AND stock >= :quantity", { productId, quantity })
				.returning(["stock"])
				.execute();
			if (result.affected !== 1) {
				throw new ConflictException(`${product.name} is out of stock`);
			}
			const after = (result.raw as { stock: number }[])[0].stock;
			await this.notifications.stockChanged(
				manager,
				businessId,
				product,
				after + quantity,
				after
			);
		}

		return this.inventory.consume(
			manager,
			businessId,
			items.map((i) => ({
				productId: i.product.id,
				optionIds: i.modifiers.map((m) => m.optionId),
				quantity: i.quantity,
			}))
		);
	}

	/**
	 * The next order number, under the business row's lock so concurrent tills queue here,
	 * and the monthly quota check that lock makes exact: one till takes the last order.
	 */
	async allocateNumber(manager: EntityManager, business: Business): Promise<number> {
		// TypeORM's postgres driver answers an UPDATE … RETURNING with [rows, affected].
		const sequence = (await manager.query(
			`UPDATE "business" SET "order_seq" = "order_seq" + 1 WHERE "id" = $1 RETURNING "order_seq"`,
			[business.id]
		)) as [[{ order_seq: number }], number];
		const quota = await this.entitlements.assertOrderQuota(
			manager,
			business.id,
			business.timezone
		);
		if (quota) await this.warnQuota(manager, business, quota);
		return sequence[0][0].order_seq;
	}

	toOrderItem(
		manager: EntityManager,
		item: PricedItem,
		discount: number,
		round: number
	): OrderItem {
		return manager.create(OrderItem, {
			productId: item.product.id,
			name: item.product.name,
			art: item.product.art,
			quantity: item.quantity,
			unitPrice: item.unitPrice,
			unitCost: item.unitCost,
			costMissing: item.costMissing,
			lineTotal: Money.multiply(item.unitPrice, item.quantity),
			discount,
			note: item.note,
			toKitchen: item.toKitchen,
			round,
			modifiers: item.modifiers.map((m) => manager.create(OrderItemModifier, m)),
		});
	}

	/** Puts back the tracked products and ingredients an order took. */
	async restock(
		manager: EntityManager,
		businessId: string,
		order: Order
	): Promise<void> {
		const items = await manager.find(OrderItem, { where: { orderId: order.id } });
		const productIds = items
			.map((i) => i.productId)
			.filter((p): p is string => Boolean(p));
		const tracked = await manager.find(Product, {
			where: { id: In(productIds), businessId, trackStock: true },
			withDeleted: true,
		});
		const trackedIds = new Set(tracked.map((p) => p.id));
		for (const item of items) {
			if (item.productId && trackedIds.has(item.productId)) {
				await manager.increment(
					Product,
					{ id: item.productId },
					"stock",
					item.quantity
				);
			}
		}
		await this.inventory.restore(manager, order.ingredientUsage);
	}

	private async resolveBranch(
		manager: EntityManager,
		membership: ResolvedMembership,
		branchId?: string
	): Promise<Branch> {
		const branch = await manager.findOne(Branch, {
			where: branchId
				? { id: branchId, businessId: membership.businessId, isActive: true }
				: { businessId: membership.businessId, isDefault: true },
		});
		if (!branch) throw new NotFoundException("Branch not found");
		if (membership.branchIds && !membership.branchIds.includes(branch.id)) {
			throw new NotFoundException("Branch not found");
		}
		return branch;
	}

	/** Cashiers see their own orders only (ORDERS_READ_OWN without ORDERS_READ_ALL). */
	async findAll(
		membership: ResolvedMembership,
		query: QueryOrdersDto
	): Promise<PaginatedResponse<OrderResponse>> {
		const qb = this.orderRepository
			.createQueryBuilder("ord")
			.leftJoinAndSelect("ord.items", "item")
			.leftJoinAndSelect("item.modifiers", "modifier")
			.leftJoinAndSelect("ord.payments", "payment")
			.where("ord.business_id = :businessId", { businessId: membership.businessId });

		if (!membership.permissions.includes(Permission.ORDERS_READ_ALL)) {
			qb.andWhere("ord.member_id = :memberId", { memberId: membership.memberId });
		}
		if (membership.branchIds) {
			qb.andWhere("ord.branch_id IN (:...branchIds)", {
				branchIds: membership.branchIds,
			});
		}
		if (query.status) qb.andWhere("ord.status = :status", { status: query.status });
		if (query.method)
			qb.andWhere("payment.method = :method", { method: query.method });
		if (query.customerId)
			qb.andWhere("ord.customer_id = :customerId", { customerId: query.customerId });
		if (query.from) qb.andWhere("ord.created_at >= :from", { from: query.from });
		if (query.to) qb.andWhere("ord.created_at < :to", { to: query.to });
		if (query.search) {
			const number = Number.parseInt(query.search.replace(/^#/, ""), 10);
			qb.andWhere("ord.number = :number", {
				number: Number.isNaN(number) ? -1 : number,
			});
		}

		const page = await paginate(
			qb,
			query,
			{ createdAt: "ord.created_at", total: "ord.total" },
			{
				expression: "ord.created_at",
				order: OrderDirection.DESC,
			}
		);
		return page.map((order) => this.toResponse(order, []));
	}

	async findOne(membership: ResolvedMembership, id: string): Promise<OrderResponse> {
		const order = await this.load(membership, id);
		const audit = await this.auditLogRepository.find({
			where: { businessId: membership.businessId, entity: "order", entityId: id },
			order: { createdAt: "ASC" },
		});
		return this.toResponse(order, audit);
	}

	/** Full refund (MVP). Restocks tracked items and writes the audit row in the same transaction. */
	refund(
		membership: ResolvedMembership,
		id: string,
		dto: ReverseOrderDto
	): Promise<OrderResponse> {
		return this.reverse(
			membership,
			id,
			dto,
			OrderStatus.REFUNDED,
			AuditAction.ORDER_REFUNDED
		);
	}

	/** Void a paid order — same effect on money and stock, recorded as a cancellation. */
	cancel(
		membership: ResolvedMembership,
		id: string,
		dto: ReverseOrderDto
	): Promise<OrderResponse> {
		return this.reverse(
			membership,
			id,
			dto,
			OrderStatus.CANCELLED,
			AuditAction.ORDER_CANCELLED
		);
	}

	private async reverse(
		membership: ResolvedMembership,
		id: string,
		dto: ReverseOrderDto,
		status: OrderStatus,
		action: AuditAction
	): Promise<OrderResponse> {
		await this.dataSource.transaction((manager) =>
			this.reverseInTransaction(manager, membership, id, dto, status, action)
		);

		await this.cacheService.bump(CacheKeys.dashboardVersion(membership.businessId));
		return this.findOne(membership, id);
	}

	/**
	 * Refund or void inside the caller's transaction. A PAID order has its payment marked
	 * refunded; an unpaid table tab (PENDING_PAYMENT) may only be voided, and has none.
	 */
	async reverseInTransaction(
		manager: EntityManager,
		membership: ResolvedMembership,
		id: string,
		dto: ReverseOrderDto,
		status: OrderStatus,
		action: AuditAction,
		/** Only the table tab's own cancel may void its unpaid order. */
		{ tab = false }: { tab?: boolean } = {}
	): Promise<void> {
		// Lock the row so two managers cannot refund the same order twice.
		const order = await manager
			.getRepository(Order)
			.createQueryBuilder("ord")
			.setLock("pessimistic_write")
			.where("ord.id = :id AND ord.business_id = :businessId", {
				id,
				businessId: membership.businessId,
			})
			.getOne();
		if (!order) throw new NotFoundException("Order not found");
		const voidingTab =
			tab &&
			order.status === OrderStatus.PENDING_PAYMENT &&
			status === OrderStatus.CANCELLED;
		if (order.status !== OrderStatus.PAID && !voidingTab) {
			throw new ConflictException(`Order is already ${order.status.toLowerCase()}`);
		}

		await this.restock(manager, membership.businessId, order);

		await manager.update(Order, { id: order.id }, { status });
		await manager.update(
			Payment,
			{ orderId: order.id, status: PaymentStatus.SUCCESS },
			{ status: PaymentStatus.REFUNDED }
		);

		const actor = await manager.findOneOrFail(BusinessMember, {
			where: { id: membership.memberId },
		});
		await manager.save(
			manager.create(AuditLog, {
				businessId: membership.businessId,
				memberId: membership.memberId,
				actorName: actor.displayName,
				action,
				entity: "order",
				entityId: order.id,
				payload: { reason: dto.reason ?? null, total: order.total },
			})
		);
		await this.notifications.emit(
			manager,
			membership.businessId,
			status === OrderStatus.REFUNDED
				? NotificationKind.REFUND
				: NotificationKind.CANCELLED,
			{
				number: order.number,
				total: order.total,
				actor: actor.displayName,
				reason: dto.reason ?? null,
			},
			{ entityId: order.id, branchId: order.branchId }
		);
		await this.realtime.publish(manager, {
			topic: "orders",
			businessId: membership.businessId,
			branchId: order.branchId,
		});
		if (order.kitchenStatus) {
			await this.realtime.publish(manager, {
				topic: "kitchen",
				businessId: membership.businessId,
				branchId: order.branchId,
			});
		}
	}

	/**
	 * Tells the owner once at 80% of the month's orders and once at the limit, so the till
	 * stopping is never the first they hear of it.
	 */
	private async warnQuota(
		manager: EntityManager,
		business: Business,
		{ used, limit }: { used: number; limit: number }
	): Promise<void> {
		const full = used === limit;
		if (!full && used !== Math.ceil(limit * 0.8)) return;
		const month = new Intl.DateTimeFormat("en-CA", {
			timeZone: business.timezone,
			year: "numeric",
			month: "2-digit",
		}).format(new Date());
		await this.notifications.emit(
			manager,
			business.id,
			NotificationKind.ORDER_QUOTA,
			{ used, limit, full },
			{ dedupeKey: `quota:${month}:${full ? "full" : "near"}` }
		);
	}

	/** A customer of this shop, on a plan that has customers — or the sale is refused. */
	private async resolveCustomer(
		manager: EntityManager,
		membership: ResolvedMembership,
		customerId: string
	) {
		if (
			!(await this.entitlements.hasFeature(membership.businessId, Feature.CUSTOMERS))
		) {
			throw new ForbiddenException(
				`Your plan does not include ${Feature.CUSTOMERS}`
			);
		}
		const customer = await manager.findOne(Customer, {
			where: { id: customerId, businessId: membership.businessId },
		});
		if (!customer) throw new NotFoundException("Customer not found");
		return customer;
	}

	private async findByClientId(
		businessId: string,
		clientOrderId: string
	): Promise<OrderResponse | null> {
		const order = await this.orderRepository.findOne({
			where: { businessId, clientOrderId },
			relations: ORDER_RELATIONS,
		});
		return order ? this.toResponse(order, []) : null;
	}

	private async load(membership: ResolvedMembership, id: string): Promise<Order> {
		const order = await this.orderRepository.findOne({
			where: { id, businessId: membership.businessId },
			relations: ORDER_RELATIONS,
		});
		const hidden =
			order &&
			!membership.permissions.includes(Permission.ORDERS_READ_ALL) &&
			order.memberId !== membership.memberId;
		if (!order || hidden) throw new NotFoundException("Order not found");
		return order;
	}

	private toResponse(order: Order, audit: AuditLog[]): OrderResponse {
		const payment = order.payments?.[0];
		return {
			id: order.id,
			number: String(order.number).padStart(6, "0"),
			createdAt: order.createdAt.toISOString(),
			branchId: order.branchId,
			employeeName: order.employeeName,
			paymentMethod: payment?.method ?? PaymentMethod.OTHER,
			status: order.status,
			items: [...(order.items ?? [])]
				.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
				.map((item) => ({
					id: item.id,
					productId: item.productId,
					name: item.name,
					art: item.art,
					quantity: item.quantity,
					unitPrice: item.unitPrice,
					modifiers: (item.modifiers ?? []).map((m) => ({
						groupName: m.groupName,
						optionName: m.optionName,
						priceDelta: m.priceDelta,
					})),
					note: item.note,
					lineTotal: item.lineTotal,
				})),
			subtotal: order.subtotal,
			discount: order.discount,
			vat: order.vat,
			total: order.total,
			received: payment?.received ?? null,
			change: payment?.change ?? null,
			customerName: order.customerName,
			serviceType: order.serviceType,
			label: order.label,
			audit: audit.map((a) => ({
				action: a.action,
				actorName: a.actorName,
				reason: (a.payload?.reason as string | null) ?? null,
				createdAt: a.createdAt.toISOString(),
			})),
		};
	}
}
