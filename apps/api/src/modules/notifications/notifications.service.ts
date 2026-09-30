import { BusinessMember } from "@/models/businesses/entities/business-member.entity";
import { Business } from "@/models/businesses/entities/business.entity";
import { Notification } from "@/models/notifications/entities/notification.entity";
import {
	NotificationListResponse,
	NotificationPreferenceResponse,
	QueryNotificationsDto,
	UpdateNotificationPreferencesDto,
} from "@/modules/notifications/dto/notification.dto";
import type { ResolvedMembership } from "@/shared/decorators/current-membership.decorator";
import { NotificationKind } from "@/shared/enums/notification.enum";
import { Permission } from "@/shared/enums/permission.enum";
import { RealtimeService } from "@/modules/realtime/realtime.service";
import { Injectable, NotFoundException } from "@nestjs/common";
import { Brackets, DataSource, EntityManager, In } from "typeorm";

/**
 * Who may see each kind: the same people who could find it out on the matching screen.
 * `null` is everyone in the shop.
 */
const AUDIENCE: Record<NotificationKind, Permission | null> = {
	[NotificationKind.LOW_STOCK]: Permission.PRODUCTS_READ,
	[NotificationKind.OUT_OF_STOCK]: Permission.PRODUCTS_READ,
	[NotificationKind.REFUND]: Permission.ORDERS_READ_ALL,
	[NotificationKind.CANCELLED]: Permission.ORDERS_READ_ALL,
	[NotificationKind.DAILY_SUMMARY]: Permission.REPORTS_READ,
	[NotificationKind.ORDER_QUOTA]: Permission.SUBSCRIPTION_MANAGE,
	[NotificationKind.PAYMENT_FAILED]: Permission.SUBSCRIPTION_MANAGE,
	// Posly speaking to the shop (maintenance, new features): everyone who works there.
	[NotificationKind.ANNOUNCEMENT]: null,
};

interface StockProduct {
	id: string;
	name: string;
	unit: string;
	lowStockAt: number | null;
}

@Injectable()
export class NotificationsService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly realtime: RealtimeService
	) {}

	/**
	 * Records an event inside the caller's transaction, so a rolled-back sale leaves no
	 * "stock ran out" behind. A repeated `dedupeKey` is silently dropped.
	 */
	async emit(
		manager: EntityManager,
		businessId: string,
		kind: NotificationKind,
		data: Record<string, unknown>,
		options: { entityId?: string; branchId?: string | null; dedupeKey?: string } = {}
	): Promise<void> {
		const result = await manager
			.createQueryBuilder()
			.insert()
			.into(Notification)
			.values({
				businessId,
				kind,
				// jsonb: TypeORM's deep-partial insert type cannot describe an open record.
				data: data as object,
				entityId: options.entityId ?? null,
				branchId: options.branchId ?? null,
				dedupeKey: options.dedupeKey ?? null,
			})
			.orIgnore()
			.execute();
		// A duplicate (dedupe key) inserted nothing, and rings no bell.
		if ((result.raw as unknown[]).length > 0) {
			await this.realtime.publish(manager, {
				topic: "notifications",
				businessId,
				branchId: options.branchId ?? null,
			});
		}
	}

	/**
	 * Called whenever a tracked product's stock moves. Only a crossing is news: dropping to
	 * the reorder level, or to zero — not every sale below it.
	 */
	async stockChanged(
		manager: EntityManager,
		businessId: string,
		product: StockProduct,
		before: number,
		after: number,
		/** Merged into the payload, e.g. `{ ingredient: true }` so the reader links to it. */
		extra: Record<string, unknown> = {}
	): Promise<void> {
		const data = { name: product.name, unit: product.unit, stock: after, ...extra };
		if (after <= 0 && before > 0) {
			await this.emit(manager, businessId, NotificationKind.OUT_OF_STOCK, data, {
				entityId: product.id,
			});
		} else if (
			product.lowStockAt !== null &&
			after <= product.lowStockAt &&
			before > product.lowStockAt
		) {
			await this.emit(
				manager,
				businessId,
				NotificationKind.LOW_STOCK,
				{ ...data, lowStockAt: product.lowStockAt },
				{ entityId: product.id }
			);
		}
	}

	async list(
		membership: ResolvedMembership,
		query: QueryNotificationsDto
	): Promise<NotificationListResponse> {
		const member = await this.dataSource
			.getRepository(BusinessMember)
			.findOneOrFail({ where: { id: membership.memberId } });
		const kinds = this.audibleKinds(membership).filter(
			(kind) => !member.mutedNotifications.includes(kind)
		);
		if (kinds.length === 0) return { items: [], unread: 0 };

		if (
			kinds.includes(NotificationKind.DAILY_SUMMARY) &&
			membership.branchIds === null
		) {
			await this.ensureDailySummary(membership.businessId);
		}

		const readAt = member.notificationsReadAt;

		const visible = () => {
			const qb = this.dataSource
				.getRepository(Notification)
				.createQueryBuilder("n")
				.where("n.businessId = :businessId", { businessId: membership.businessId })
				.andWhere({ kind: In(kinds) });
			// A member limited to some branches hears about those branches and about shop-wide
			// events — except the daily summary, which is a whole-shop figure.
			const branchIds = membership.branchIds;
			if (branchIds !== null) {
				qb.andWhere(
					new Brackets((w) => {
						w.where("n.branchId IS NULL AND n.kind <> :daily", {
							daily: NotificationKind.DAILY_SUMMARY,
						});
						if (branchIds.length > 0)
							w.orWhere("n.branchId IN (:...branchIds)", { branchIds });
					})
				);
			}
			return qb;
		};

		const [rows, unread] = await Promise.all([
			visible()
				.orderBy("n.createdAt", "DESC")
				.take(query.limit ?? 30)
				.getMany(),
			(readAt
				? visible().andWhere("n.createdAt > :readAt", { readAt })
				: visible()
			).getCount(),
		]);

		return {
			items: rows.map((n) => ({
				id: n.id,
				kind: n.kind,
				entityId: n.entityId,
				data: n.data,
				read: readAt !== null && n.createdAt <= readAt,
				createdAt: n.createdAt,
			})),
			unread,
		};
	}

	/** The kinds this member's permissions let them hear about, whether muted or not. */
	private audibleKinds(membership: ResolvedMembership): NotificationKind[] {
		return (Object.keys(AUDIENCE) as NotificationKind[]).filter((kind) => {
			const permission = AUDIENCE[kind];
			return permission === null || membership.permissions.includes(permission);
		});
	}

	async preferences(
		membership: ResolvedMembership
	): Promise<NotificationPreferenceResponse[]> {
		const member = await this.dataSource
			.getRepository(BusinessMember)
			.findOneOrFail({ where: { id: membership.memberId } });
		return this.audibleKinds(membership).map((kind) => ({
			kind,
			enabled: !member.mutedNotifications.includes(kind),
		}));
	}

	/** Replaces this member's muted list; kinds they cannot see anyway are ignored. */
	async updatePreferences(
		membership: ResolvedMembership,
		dto: UpdateNotificationPreferencesDto
	): Promise<NotificationPreferenceResponse[]> {
		const audible = this.audibleKinds(membership);
		const muted = [...new Set(dto.muted)].filter((kind) => audible.includes(kind));
		await this.dataSource
			.getRepository(BusinessMember)
			.update({ id: membership.memberId }, { mutedNotifications: muted });
		return this.preferences(membership);
	}

	async markAllRead(membership: ResolvedMembership): Promise<void> {
		await this.dataSource
			.getRepository(BusinessMember)
			.update({ id: membership.memberId }, { notificationsReadAt: () => "now()" });
	}

	/**
	 * Yesterday's takings, written the first time someone who may see it opens the list —
	 * no scheduler to keep in step with every shop's timezone. Days without a sale say nothing.
	 */
	private async ensureDailySummary(businessId: string): Promise<void> {
		const business = await this.dataSource
			.getRepository(Business)
			.findOne({ where: { id: businessId } });
		if (!business) throw new NotFoundException("Business not found");

		const [row] = (await this.dataSource.query(
			`WITH d AS (SELECT date_trunc('day', now() AT TIME ZONE $2) AS today)
			 SELECT to_char(d.today - interval '1 day', 'YYYY-MM-DD') AS day,
			        COUNT(o.id)::int AS orders,
			        COALESCE(SUM(o.total), 0)::bigint AS revenue
			   FROM d LEFT JOIN "order" o
			     ON o.business_id = $1 AND o.deleted_at IS NULL AND o.status = 'PAID'
			    AND o.created_at >= (d.today - interval '1 day') AT TIME ZONE $2
			    AND o.created_at < d.today AT TIME ZONE $2
			  GROUP BY d.today`,
			[businessId, business.timezone]
		)) as { day: string; orders: number; revenue: string }[];

		if (!row || row.orders === 0) return;
		await this.emit(
			this.dataSource.manager,
			businessId,
			NotificationKind.DAILY_SUMMARY,
			{ day: row.day, orders: row.orders, revenue: Number(row.revenue) },
			{ dedupeKey: `daily:${row.day}` }
		);
	}
}
