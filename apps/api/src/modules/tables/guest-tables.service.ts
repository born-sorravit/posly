import { Business } from "@/models/businesses/entities/business.entity";
import { Category } from "@/models/catalog/entities/category.entity";
import { Product } from "@/models/catalog/entities/product.entity";
import { Order } from "@/models/orders/entities/order.entity";
import { DiningTable } from "@/models/tables/entities/dining-table.entity";
import { TableRequest } from "@/models/tables/entities/table-request.entity";
import { TableSession } from "@/models/tables/entities/table-session.entity";
import { toModifierGroupResponse } from "@/modules/catalog/catalog.mapper";
import { OrdersService } from "@/modules/orders/orders.service";
import { RealtimeService } from "@/modules/realtime/realtime.service";
import { StorageService } from "@/modules/storage/storage.service";
import {
	GuestMenuResponse,
	GuestRequestDto,
	GuestTabResponse,
} from "@/modules/tables/dto/table.dto";
import {
	TablesService,
	sortedItems,
	toRequestLine,
} from "@/modules/tables/tables.service";
import { TableRequestStatus, TableSessionStatus } from "@/shared/enums/table.enum";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { DataSource, EntityManager, In } from "typeorm";

/** Rounds a table may have waiting at once: enough for a big party, not for a prank. */
const MAX_PENDING = 5;

/**
 * What guests reach from the QR on a table, with no login: the menu, sending a round and
 * the table's bill. The token is the only key, and it opens one table; everything shown
 * leaves out what is the shop's business — costs, stock counts, staff and customer names.
 */
@Injectable()
export class GuestTablesService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly orders: OrdersService,
		private readonly tables: TablesService,
		private readonly realtime: RealtimeService,
		private readonly storage: StorageService
	) {}

	async menu(token: string): Promise<GuestMenuResponse> {
		const table = await this.loadTable(this.dataSource.manager, token);
		const [business, session, categories, products] = await Promise.all([
			this.dataSource
				.getRepository(Business)
				.findOneOrFail({ where: { id: table.businessId } }),
			this.openSession(this.dataSource.manager, table),
			this.dataSource.getRepository(Category).find({
				where: { businessId: table.businessId, isActive: true },
				order: { displayOrder: "ASC", createdAt: "ASC" },
			}),
			this.dataSource.getRepository(Product).find({
				where: { businessId: table.businessId, isActive: true },
				relations: { modifierGroups: { options: true } },
				order: { name: "ASC" },
			}),
		]);
		const shown = new Set(categories.map((c) => c.id));
		return {
			shopName: business.name,
			logoUrl: business.logoPath ? this.storage.publicUrl(business.logoPath) : null,
			tableName: table.name,
			open: Boolean(session),
			categories: categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon })),
			products: products
				.filter((p) => !p.categoryId || shown.has(p.categoryId))
				.map((p) => ({
					id: p.id,
					categoryId: p.categoryId,
					name: p.name,
					price: p.price,
					art: p.art,
					imageUrl: p.imagePath ? this.storage.publicUrl(p.imagePath) : null,
					soldOut: p.trackStock && (p.stock ?? 0) <= 0,
					modifierGroups: [...(p.modifierGroups ?? [])]
						.sort((a, b) => a.displayOrder - b.displayOrder)
						.map(toModifierGroupResponse)
						.map((g) => ({
							id: g.id,
							name: g.name,
							selection: g.selection,
							required: g.required,
							options: g.options.map((o) => ({
								id: o.id,
								name: o.name,
								priceDelta: o.priceDelta,
								isDefault: o.isDefault,
							})),
						})),
				})),
		};
	}

	async request(token: string, dto: GuestRequestDto): Promise<GuestTabResponse> {
		const lines = dto.items.map(toRequestLine);
		await this.dataSource.transaction(async (manager) => {
			const table = await this.loadTable(manager, token);
			const session = await this.openSession(manager, table, true);
			if (!session)
				throw new ConflictException("This table is not open for ordering");

			const existing = await manager.findOne(TableRequest, {
				where: { sessionId: session.id, clientRequestId: dto.clientRequestId },
			});
			if (existing) return;
			const pending = await manager.count(TableRequest, {
				where: { sessionId: session.id, status: TableRequestStatus.PENDING },
			});
			if (pending >= MAX_PENDING)
				throw new ConflictException(
					"Please wait for staff to confirm your last order"
				);

			// Checks the products and options are this shop's and valid — prices are not kept.
			const priced = await this.orders.priceLines(manager, table.businessId, lines);
			for (const item of priced) {
				const wanted = priced
					.filter((i) => i.product.id === item.product.id)
					.reduce((n, i) => n + i.quantity, 0);
				if (item.product.trackStock && (item.product.stock ?? 0) < wanted)
					throw new ConflictException(`${item.product.name} is out of stock`);
			}

			await manager.save(
				manager.create(TableRequest, {
					businessId: table.businessId,
					branchId: table.branchId,
					sessionId: session.id,
					clientRequestId: dto.clientRequestId,
					items: lines,
					status: TableRequestStatus.PENDING,
					handledByMemberId: null,
					handledAt: null,
				})
			);
			await this.realtime.publish(manager, {
				topic: "tables",
				businessId: table.businessId,
				branchId: table.branchId,
			});
		});
		return this.tab(token);
	}

	async tab(token: string): Promise<GuestTabResponse> {
		const table = await this.loadTable(this.dataSource.manager, token);
		const session = await this.openSession(this.dataSource.manager, table);
		if (!session) return { open: false, lines: [], total: 0, requests: [] };
		const [order, requests] = await Promise.all([
			session.orderId
				? this.dataSource.getRepository(Order).findOne({
						where: { id: session.orderId },
						relations: { items: { modifiers: true } },
					})
				: null,
			this.dataSource.getRepository(TableRequest).find({
				where: {
					sessionId: session.id,
					status: In([TableRequestStatus.PENDING, TableRequestStatus.REJECTED]),
				},
				order: { createdAt: "ASC" },
			}),
		]);
		return {
			open: true,
			lines: sortedItems(order).map((item) => ({
				name: item.name,
				quantity: item.quantity,
				lineTotal: item.lineTotal,
				modifiers: (item.modifiers ?? []).map((m) => m.optionName),
				note: item.note,
				round: item.round,
				ready: !item.toKitchen || item.preparedAt !== null,
			})),
			total: order?.total ?? 0,
			requests: await this.tables.describeRequests(table.businessId, requests),
		};
	}

	private async loadTable(
		manager: EntityManager,
		token: string
	): Promise<DiningTable> {
		const table =
			token.length <= 64
				? await manager.findOne(DiningTable, {
						where: { qrToken: token, isActive: true },
					})
				: null;
		if (!table) throw new NotFoundException("Table not found");
		return table;
	}

	private openSession(manager: EntityManager, table: DiningTable, lock = false) {
		const qb = manager
			.getRepository(TableSession)
			.createQueryBuilder("s")
			.where("s.table_id = :tableId AND s.status = :open", {
				tableId: table.id,
				open: TableSessionStatus.OPEN,
			});
		// Shared with staff closing the tab: a round never lands on a tab that just closed.
		if (lock) qb.setLock("pessimistic_read");
		return qb.getOne();
	}
}
