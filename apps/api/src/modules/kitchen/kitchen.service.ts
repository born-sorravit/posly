import { Order } from "@/models/orders/entities/order.entity";
import { OrderItem } from "@/models/orders/entities/order-item.entity";
import {
	KitchenBoardResponse,
	KitchenTicketResponse,
	QueryKitchenDto,
} from "@/modules/kitchen/dto/kitchen.dto";
import { RealtimeService } from "@/modules/realtime/realtime.service";
import type { ResolvedMembership } from "@/shared/decorators/current-membership.decorator";
import { KitchenStatus, OrderStatus } from "@/shared/enums/order.enum";
import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { Brackets, DataSource, EntityManager } from "typeorm";

/** Tickets older than this are yesterday's leftovers, not today's queue. */
const OPEN_WINDOW_HOURS = 18;
const RECALL_MINUTES = 15;

/**
 * The kitchen screen (plan §27): paid orders and open table tabs with something to cook, as tickets that move
 * NEW → PREPARING → READY → SERVED. Only the lines whose category cooks are shown; a
 * refunded or cancelled order leaves the board at once.
 */
@Injectable()
export class KitchenService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly realtime: RealtimeService
	) {}

	async board(
		membership: ResolvedMembership,
		query: QueryKitchenDto
	): Promise<KitchenBoardResponse> {
		if (
			query.branchId &&
			membership.branchIds &&
			!membership.branchIds.includes(query.branchId)
		) {
			throw new ForbiddenException("Not your branch");
		}
		const base = () => {
			const qb = this.dataSource
				.getRepository(Order)
				.createQueryBuilder("ord")
				.leftJoinAndSelect("ord.items", "item", "item.to_kitchen = true")
				.leftJoinAndSelect("item.modifiers", "modifier")
				.where("ord.business_id = :businessId", {
					businessId: membership.businessId,
				})
				// An open table tab cooks before it is paid.
				.andWhere("ord.status IN (:...cooking)", {
					cooking: [OrderStatus.PAID, OrderStatus.PENDING_PAYMENT],
				});
			if (query.branchId)
				qb.andWhere("ord.branch_id = :branchId", { branchId: query.branchId });
			else if (membership.branchIds) {
				qb.andWhere(
					new Brackets((w) =>
						membership.branchIds?.length
							? w.where("ord.branch_id IN (:...branchIds)", {
									branchIds: membership.branchIds,
								})
							: w.where("false")
					)
				);
			}
			return qb;
		};

		const [open, recent] = await Promise.all([
			base()
				.andWhere("ord.kitchen_status IN (:...open)", {
					open: [KitchenStatus.NEW, KitchenStatus.PREPARING, KitchenStatus.READY],
				})
				// A tab's later round counts from when it was sent, not when the table opened.
				.andWhere(
					`COALESCE(ord.kitchen_updated_at, ord.created_at) > now() - interval '${OPEN_WINDOW_HOURS} hours'`
				)
				.orderBy("ord.created_at", "ASC")
				.addOrderBy("item.created_at", "ASC")
				.getMany(),
			base()
				.andWhere("ord.kitchen_status = :served", { served: KitchenStatus.SERVED })
				.andWhere(
					`ord.kitchen_updated_at > now() - interval '${RECALL_MINUTES} minutes'`
				)
				.orderBy("ord.kitchen_updated_at", "DESC")
				.addOrderBy("item.created_at", "ASC")
				.take(10)
				.getMany(),
		]);
		return { open: open.map(toTicket), recent: recent.map(toTicket) };
	}

	async setStatus(
		membership: ResolvedMembership,
		orderId: string,
		status: KitchenStatus
	): Promise<KitchenTicketResponse> {
		return this.dataSource.transaction(async (manager) => {
			const order = await this.loadOpen(manager, membership, orderId);
			await manager.update(
				Order,
				{ id: order.id },
				{ kitchenStatus: status, kitchenUpdatedAt: new Date() }
			);
			// Marking a ticket ready means every line is done; sending one back leaves the ticks alone.
			if (status === KitchenStatus.READY || status === KitchenStatus.SERVED) {
				await manager
					.createQueryBuilder()
					.update(OrderItem)
					.set({ preparedAt: () => "COALESCE(prepared_at, now())" })
					.where("order_id = :id AND to_kitchen = true", { id: order.id })
					.execute();
			}
			await this.announce(manager, order);
			return this.ticket(manager, order.id);
		});
	}

	/**
	 * Ticks one line off (or back on). The first tick starts the ticket; the last one makes
	 * it ready — so a cook who only ticks lines never has to touch the status buttons.
	 */
	async setPrepared(
		membership: ResolvedMembership,
		orderId: string,
		itemId: string,
		prepared: boolean
	): Promise<KitchenTicketResponse> {
		return this.dataSource.transaction(async (manager) => {
			const order = await this.loadOpen(manager, membership, orderId);
			const item = await manager.findOne(OrderItem, {
				where: { id: itemId, orderId: order.id, toKitchen: true },
			});
			if (!item) throw new NotFoundException("Line not found");
			await manager.update(
				OrderItem,
				{ id: item.id },
				{ preparedAt: prepared ? new Date() : null }
			);

			const lines = await manager.find(OrderItem, {
				where: { orderId: order.id, toKitchen: true },
			});
			const done = lines.every((l) => l.preparedAt !== null);
			const next =
				done && order.kitchenStatus !== KitchenStatus.SERVED
					? KitchenStatus.READY
					: !done && order.kitchenStatus === KitchenStatus.READY
						? KitchenStatus.PREPARING
						: order.kitchenStatus === KitchenStatus.NEW && prepared
							? KitchenStatus.PREPARING
							: order.kitchenStatus;
			if (next !== order.kitchenStatus) {
				await manager.update(
					Order,
					{ id: order.id },
					{ kitchenStatus: next, kitchenUpdatedAt: new Date() }
				);
			}
			await this.announce(manager, order);
			return this.ticket(manager, order.id);
		});
	}

	/**
	 * Every kitchen screen for this branch redraws — the tap on one tablet shows on all. A table's
	 * ticket also redraws its tab, so the floor sees "served" without a refresh.
	 */
	private async announce(manager: EntityManager, order: Order): Promise<void> {
		const target = { businessId: order.businessId, branchId: order.branchId };
		await this.realtime.publish(manager, { topic: "kitchen", ...target });
		if (order.tableSessionId)
			await this.realtime.publish(manager, { topic: "tables", ...target });
	}

	/** A paid order of this shop that has a ticket, locked for the change. */
	private async loadOpen(
		manager: EntityManager,
		membership: ResolvedMembership,
		orderId: string
	): Promise<Order> {
		const order = await manager
			.getRepository(Order)
			.createQueryBuilder("ord")
			.setLock("pessimistic_write")
			.where("ord.id = :orderId AND ord.business_id = :businessId", {
				orderId,
				businessId: membership.businessId,
			})
			.getOne();
		if (
			!order ||
			(membership.branchIds && !membership.branchIds.includes(order.branchId))
		) {
			throw new NotFoundException("Order not found");
		}
		if (order.kitchenStatus === null)
			throw new ConflictException("This order has nothing for the kitchen");
		if (
			order.status !== OrderStatus.PAID &&
			order.status !== OrderStatus.PENDING_PAYMENT
		)
			throw new ConflictException(`Order is ${order.status.toLowerCase()}`);
		return order;
	}

	private async ticket(
		manager: EntityManager,
		orderId: string
	): Promise<KitchenTicketResponse> {
		const order = await manager
			.getRepository(Order)
			.createQueryBuilder("ord")
			.leftJoinAndSelect("ord.items", "item", "item.to_kitchen = true")
			.leftJoinAndSelect("item.modifiers", "modifier")
			.where("ord.id = :orderId", { orderId })
			.orderBy("item.created_at", "ASC")
			.getOneOrFail();
		return toTicket(order);
	}
}

const toTicket = (order: Order): KitchenTicketResponse => ({
	id: order.id,
	number: String(order.number).padStart(6, "0"),
	status: order.kitchenStatus as KitchenStatus,
	createdAt: order.createdAt.toISOString(),
	updatedAt: (order.kitchenUpdatedAt ?? order.createdAt).toISOString(),
	branchId: order.branchId,
	employeeName: order.employeeName,
	customerName: order.customerName,
	serviceType: order.serviceType,
	label: order.label,
	lines: (order.items ?? []).map((item) => ({
		id: item.id,
		name: item.name,
		quantity: item.quantity,
		note: item.note,
		modifiers: (item.modifiers ?? []).map((m) => m.optionName),
		preparedAt: item.preparedAt?.toISOString() ?? null,
		round: item.round,
	})),
});
