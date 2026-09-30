import type { AppConfig } from "@/config/configuration";
import { EntitlementsService } from "@/modules/subscriptions/entitlements.service";
import { CacheService } from "@/shared/cache/cache.service";
import type { AuthenticatedUser } from "@/shared/decorators/current-user.decorator";
import { MemberRole } from "@/shared/enums/member-role.enum";
import { MemberStatus } from "@/shared/enums/member-status.enum";
import { OrderStatus } from "@/shared/enums/order.enum";
import { PlanCode, SubscriptionStatus } from "@/shared/enums/subscription.enum";
import { DEMO_EMAIL_DOMAIN } from "@/shared/utils/demo.util";
import {
	PaginatedResponse,
	getPaginationOptions,
} from "@/shared/utils/pagination.util";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, type EntityManager } from "typeorm";
import {
	AdminActionRow,
	AdminActionsQueryDto,
	AdminAttentionResponse,
	AdminAttentionRow,
	AdminActivityQueryDto,
	AdminAuditRow,
	AdminBusinessDetail,
	AdminBusinessRow,
	AdminBusinessesQueryDto,
	AdminOrderRow,
	AdminOverviewQueryDto,
	AdminOverviewResponse,
	AdminRecentOrdersQueryDto,
	AdminRevokeSessionsDto,
	AdminSetPlanDto,
	AdminSubscriptionRow,
	AdminSubscriptionSummary,
	AdminSubscriptionsQueryDto,
	AdminSystemResponse,
	AdminUserDetail,
	AdminUserRow,
	AdminUsersQueryDto,
} from "@/modules/admin/dto/admin.dto";

/*
 * SQL fragments. Everything interpolated below is a constant from this file or an enum —
 * never client input, which always travels as a bound parameter.
 */
const DEMO_LIKE = `'%@${DEMO_EMAIL_DOMAIN}'`;
const PAID = `'${OrderStatus.PAID}'`;

/** True when the business `alias` is owned by a demo account (the shared "try it" shop). */
const isDemoShop = (alias: string) => `EXISTS (
	SELECT 1 FROM business_member dm JOIN "user" du ON du.id = dm.user_id
	WHERE dm.business_id = ${alias}.id AND dm.role = '${MemberRole.OWNER}'
	  AND dm.deleted_at IS NULL AND du.email ILIKE ${DEMO_LIKE})`;

/** Live shops, optionally without the demo one. Used as a CTE so every figure agrees. */
const shopsCte = (includeDemo: boolean) => `shops AS (
	SELECT b.id FROM business b
	WHERE b.deleted_at IS NULL ${includeDemo ? "" : `AND NOT ${isDemoShop("b")}`})`;

const userFilter = (includeDemo: boolean, alias = "u") =>
	`${alias}.deleted_at IS NULL ${includeDemo ? "" : `AND ${alias}.email NOT ILIKE ${DEMO_LIKE}`}`;

/** `%term%` with LIKE's own wildcards escaped, so a search for "50%" means that literally. */
const contains = (term?: string) =>
	term?.trim() ? `%${term.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;

/** node-postgres returns bigint and numeric as strings. */
const num = (value: unknown): number => (value == null ? 0 : Number(value));
const iso = (value: unknown): string | null =>
	value == null ? null : new Date(value as string).toISOString();

const mb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10;

const toAttentionRow = (row: Record<string, unknown>): AdminAttentionRow => ({
	businessId: row.businessId as string,
	businessName: row.businessName as string,
	ownerEmail: (row.ownerEmail as string) ?? null,
	plan: (row.plan as string) ?? null,
	endDate: iso(row.endDate),
	lastOrderAt: iso(row.lastOrderAt),
	ordersThisMonth: row.ordersThisMonth == null ? null : num(row.ordersThisMonth),
	orderLimit: row.orderLimit == null ? null : num(row.orderLimit),
	createdAt: iso(row.createdAt) as string,
	cancelAtPeriodEnd: Boolean(row.cancelAtPeriodEnd),
});

/**
 * Read-only, platform-wide queries for the admin monitor.
 *
 * Every aggregate filters `deleted_at IS NULL` itself: these are raw queries, so TypeORM's
 * soft-delete filter does not apply. Revenue follows the shop dashboard's rule
 * (`ReportsService`): PAID orders, by `created_at`, so the two screens agree.
 */
@Injectable()
export class AdminService {
	private readonly timezone: string;

	constructor(
		@InjectDataSource() private readonly dataSource: DataSource,
		private readonly cacheService: CacheService,
		private readonly configService: ConfigService,
		private readonly entitlements: EntitlementsService
	) {
		this.timezone = configService.get<AppConfig>("app")?.timezone ?? "Asia/Bangkok";
	}

	overview(query: AdminOverviewQueryDto): Promise<AdminOverviewResponse> {
		const { days, includeDemo } = query;
		return this.cacheService.remember(
			`admin:overview:${days}:${includeDemo}`,
			() => this.computeOverview(days, includeDemo),
			60
		);
	}

	private async computeOverview(
		days: number,
		includeDemo: boolean
	): Promise<AdminOverviewResponse> {
		const tz = this.timezone;
		const bounds = `bounds AS (SELECT
			date_trunc('day', now() AT TIME ZONE $1) AT TIME ZONE $1 AS today,
			(date_trunc('day', now() AT TIME ZONE $1) - make_interval(days => $2::int - 1)) AT TIME ZONE $1 AS since)`;

		const [totals] = await this.dataSource.query(
			`WITH ${shopsCte(includeDemo)}, ${bounds}
			SELECT
				(SELECT COUNT(*) FROM shops)::int AS businesses,
				(SELECT COUNT(*) FROM business b WHERE b.id IN (SELECT id FROM shops)
					AND b.created_at >= (SELECT since FROM bounds))::int AS "newBusinesses",
				(SELECT COUNT(*) FROM "user" u WHERE ${userFilter(includeDemo)})::int AS users,
				(SELECT COUNT(*) FROM "user" u WHERE ${userFilter(includeDemo)}
					AND u.created_at >= (SELECT since FROM bounds))::int AS "newUsers",
				(SELECT COUNT(*) FROM "order" oa WHERE oa.deleted_at IS NULL AND oa.status = ${PAID}
					AND oa.business_id IN (SELECT id FROM shops))::int AS "ordersAllTime",
				COUNT(*) FILTER (WHERE o.status = ${PAID} AND o.created_at >= bounds.today)::int AS "ordersToday",
				COALESCE(SUM(o.total) FILTER (WHERE o.status = ${PAID} AND o.created_at >= bounds.today), 0)::bigint AS "gmvToday",
				COUNT(*) FILTER (WHERE o.status = ${PAID})::int AS "ordersPeriod",
				COALESCE(SUM(o.total) FILTER (WHERE o.status = ${PAID}), 0)::bigint AS "gmvPeriod",
				COUNT(*) FILTER (WHERE o.status = '${OrderStatus.REFUNDED}')::int AS "refundsPeriod",
				COALESCE(SUM(o.total) FILTER (WHERE o.status = '${OrderStatus.REFUNDED}'), 0)::bigint AS "refundedAmountPeriod",
				COUNT(*) FILTER (WHERE o.status = '${OrderStatus.CANCELLED}')::int AS "cancelledPeriod",
				COUNT(DISTINCT o.business_id) FILTER (WHERE o.status = ${PAID})::int AS "activeShopsPeriod"
			FROM bounds
			LEFT JOIN "order" o ON o.deleted_at IS NULL AND o.created_at >= bounds.since
				AND o.business_id IN (SELECT id FROM shops)
			GROUP BY bounds.today, bounds.since`,
			[tz, days]
		);

		const series = await this.dataSource.query(
			`WITH ${shopsCte(includeDemo)},
			days AS (
				SELECT generate_series(
					date_trunc('day', now() AT TIME ZONE $1) - make_interval(days => $2::int - 1),
					date_trunc('day', now() AT TIME ZONE $1),
					interval '1 day') AS day),
			since AS (SELECT MIN(day) AT TIME ZONE $1 AS at FROM days),
			o AS (
				SELECT date_trunc('day', created_at AT TIME ZONE $1) AS day,
					COUNT(*)::int AS orders, SUM(total)::bigint AS gmv
				FROM "order"
				WHERE deleted_at IS NULL AND status = ${PAID}
					AND business_id IN (SELECT id FROM shops) AND created_at >= (SELECT at FROM since)
				GROUP BY 1),
			u AS (
				SELECT date_trunc('day', u.created_at AT TIME ZONE $1) AS day, COUNT(*)::int AS n
				FROM "user" u
				WHERE ${userFilter(includeDemo)} AND u.created_at >= (SELECT at FROM since)
				GROUP BY 1),
			nb AS (
				SELECT date_trunc('day', b.created_at AT TIME ZONE $1) AS day, COUNT(*)::int AS n
				FROM business b
				WHERE b.id IN (SELECT id FROM shops) AND b.created_at >= (SELECT at FROM since)
				GROUP BY 1)
			SELECT to_char(days.day, 'YYYY-MM-DD') AS date,
				COALESCE(o.orders, 0) AS orders, COALESCE(o.gmv, 0) AS gmv,
				COALESCE(u.n, 0) AS signups, COALESCE(nb.n, 0) AS "newBusinesses"
			FROM days
			LEFT JOIN o ON o.day = days.day
			LEFT JOIN u ON u.day = days.day
			LEFT JOIN nb ON nb.day = days.day
			ORDER BY days.day`,
			[tz, days]
		);

		const subscriptions = await this.dataSource.query(
			`WITH ${shopsCte(includeDemo)}
			SELECT s.plan_code AS plan, s.status, COUNT(*)::int AS count
			FROM subscription s
			WHERE s.deleted_at IS NULL AND s.business_id IN (SELECT id FROM shops)
			GROUP BY 1, 2 ORDER BY 1, 2`
		);

		// Same calendar-day window as the totals, so the top shops add up to the period figure.
		const topBusinesses = await this.dataSource.query(
			`WITH ${shopsCte(includeDemo)}, ${bounds}
			SELECT b.id, b.name, COUNT(o.id)::int AS orders, COALESCE(SUM(o.total), 0)::bigint AS gmv
			FROM business b
			JOIN "order" o ON o.business_id = b.id AND o.deleted_at IS NULL AND o.status = ${PAID}
				AND o.created_at >= (SELECT since FROM bounds)
			WHERE b.id IN (SELECT id FROM shops)
			GROUP BY b.id, b.name
			ORDER BY gmv DESC
			LIMIT 5`,
			[tz, days]
		);

		return {
			days,
			totals: {
				businesses: num(totals.businesses),
				newBusinesses: num(totals.newBusinesses),
				users: num(totals.users),
				newUsers: num(totals.newUsers),
				ordersAllTime: num(totals.ordersAllTime),
				ordersToday: num(totals.ordersToday),
				gmvToday: num(totals.gmvToday),
				ordersPeriod: num(totals.ordersPeriod),
				gmvPeriod: num(totals.gmvPeriod),
				refundsPeriod: num(totals.refundsPeriod),
				refundedAmountPeriod: num(totals.refundedAmountPeriod),
				cancelledPeriod: num(totals.cancelledPeriod),
				activeShopsPeriod: num(totals.activeShopsPeriod),
			},
			subscriptions: subscriptions.map((row: Record<string, unknown>) => ({
				plan: row.plan as string,
				status: row.status as string,
				count: num(row.count),
			})),
			series: series.map((row: Record<string, unknown>) => ({
				date: row.date as string,
				orders: num(row.orders),
				gmv: num(row.gmv),
				signups: num(row.signups),
				newBusinesses: num(row.newBusinesses),
			})),
			topBusinesses: topBusinesses.map((row: Record<string, unknown>) => ({
				id: row.id as string,
				name: row.name as string,
				orders: num(row.orders),
				gmv: num(row.gmv),
			})),
		};
	}

	/**
	 * Shops an operator should look at, one list per reason. Each list is capped: it is a
	 * worklist, not a report, and the lists page links on to the shop.
	 */
	async attention(includeDemo: boolean): Promise<AdminAttentionResponse> {
		const cte = `WITH ${shopsCte(includeDemo)},
			base AS (
				SELECT b.id AS "businessId", b.name AS "businessName", b.created_at AS "createdAt",
					b.onboarded_at AS "onboardedAt", b.timezone,
					(SELECT u.email FROM business_member m JOIN "user" u ON u.id = m.user_id
						WHERE m.business_id = b.id AND m.role = '${MemberRole.OWNER}' AND m.deleted_at IS NULL
						ORDER BY m.created_at LIMIT 1) AS "ownerEmail",
					s.plan_code AS plan, s.status, s.end_date AS "endDate",
					s.cancel_at_period_end AS "cancelAtPeriodEnd",
					(SELECT MAX(o.created_at) FROM "order" o
						WHERE o.business_id = b.id AND o.deleted_at IS NULL) AS "lastOrderAt"
				FROM business b
				JOIN shops ON shops.id = b.id
				LEFT JOIN subscription s ON s.business_id = b.id AND s.deleted_at IS NULL)`;
		const list = async (where: string, order: string, extra = "") =>
			(
				await this.dataSource.query(
					`${cte}
					SELECT base.*, NULL::int AS "ordersThisMonth", NULL::int AS "orderLimit" ${extra}
					FROM base WHERE ${where} ORDER BY ${order} LIMIT 50`
				)
			).map(toAttentionRow);

		const [pastDue, expiring, dormant, notOnboarded] = await Promise.all([
			list(`status = '${SubscriptionStatus.PAST_DUE}'`, `"endDate" NULLS LAST`),
			list(
				`status IN ('${SubscriptionStatus.ACTIVE}', '${SubscriptionStatus.TRIALING}')
				AND plan <> '${PlanCode.FREE}'
				AND ("cancelAtPeriodEnd" OR ("endDate" IS NOT NULL AND "endDate" < now() + interval '7 days'))`,
				`"endDate" NULLS LAST`
			),
			list(
				`"lastOrderAt" IS NOT NULL AND "lastOrderAt" < now() - interval '7 days'`,
				`"lastOrderAt" DESC`
			),
			list(
				`"onboardedAt" IS NULL AND "createdAt" < now() - interval '3 days'`,
				`"createdAt" DESC`
			),
		]);

		// The plan in force, as entitlements decide it: a lapsed paid plan counts as Free.
		const nearQuota = (
			await this.dataSource.query(
				`${cte},
				usage AS (
					SELECT base.*,
						(SELECT COUNT(*) FROM "order" o
							WHERE o.business_id = base."businessId" AND o.deleted_at IS NULL
							AND o.created_at >= (date_trunc('month', now() AT TIME ZONE base.timezone) AT TIME ZONE base.timezone)
						)::int AS "ordersThisMonth",
						p.order_limit AS "orderLimit"
					FROM base
					JOIN subscription_plan p ON p.code = CASE
						WHEN base.status IN ('${SubscriptionStatus.ACTIVE}', '${SubscriptionStatus.TRIALING}')
							AND (base."endDate" IS NULL OR base."endDate" > now())
						THEN base.plan ELSE '${PlanCode.FREE}' END)
				SELECT * FROM usage
				WHERE "orderLimit" IS NOT NULL AND "ordersThisMonth" >= "orderLimit" * 0.8
				ORDER BY "ordersThisMonth"::float / NULLIF("orderLimit", 0) DESC
				LIMIT 50`
			)
		).map(toAttentionRow);

		return { pastDue, expiring, nearQuota, dormant, notOnboarded };
	}

	async businesses(
		query: AdminBusinessesQueryDto
	): Promise<PaginatedResponse<AdminBusinessRow>> {
		const { page, limit, skip, sortBy, order } = getPaginationOptions(query);
		const sortable: Record<string, string> = {
			createdAt: `b.created_at`,
			name: `b.name`,
			gmv30d: `"gmv30d"`,
			orders30d: `"orders30d"`,
			lastOrderAt: `"lastOrderAt"`,
			members: `members`,
		};
		const sort = sortable[sortBy ?? "createdAt"] ?? sortable.createdAt;

		const ownerEmail = `(SELECT u.email FROM business_member m JOIN "user" u ON u.id = m.user_id
			WHERE m.business_id = b.id AND m.role = '${MemberRole.OWNER}' AND m.deleted_at IS NULL
			ORDER BY m.created_at LIMIT 1)`;
		const where = `b.id IN (SELECT id FROM shops)
			AND ($1::text IS NULL OR b.name ILIKE $1 OR ${ownerEmail} ILIKE $1)
			AND ($2::text IS NULL OR s.plan_code = $2)`;
		const from = `business b
			LEFT JOIN subscription s ON s.business_id = b.id AND s.deleted_at IS NULL`;
		const params = [contains(query.search), query.plan ?? null];

		const [{ total }] = await this.dataSource.query(
			`WITH ${shopsCte(query.includeDemo)} SELECT COUNT(*)::int AS total FROM ${from} WHERE ${where}`,
			params
		);

		const rows = await this.dataSource.query(
			`WITH ${shopsCte(query.includeDemo)},
			stats AS (
				SELECT business_id, COUNT(*)::int AS orders, SUM(total)::bigint AS gmv
				FROM "order"
				WHERE deleted_at IS NULL AND status = ${PAID} AND created_at >= now() - interval '30 days'
				GROUP BY 1),
			last AS (
				SELECT business_id, MAX(created_at) AS at FROM "order" WHERE deleted_at IS NULL GROUP BY 1)
			SELECT b.id, b.name, b.business_type AS "businessType", b.created_at AS "createdAt",
				b.onboarded_at AS "onboardedAt", ${ownerEmail} AS "ownerEmail",
				s.plan_code AS plan, s.status AS "subscriptionStatus",
				(SELECT COUNT(*) FROM business_member m WHERE m.business_id = b.id
					AND m.deleted_at IS NULL AND m.status = '${MemberStatus.ACTIVE}')::int AS members,
				(SELECT COUNT(*) FROM branch br WHERE br.business_id = b.id AND br.deleted_at IS NULL)::int AS branches,
				COALESCE(st.orders, 0) AS "orders30d", COALESCE(st.gmv, 0) AS "gmv30d",
				l.at AS "lastOrderAt", ${isDemoShop("b")} AS "isDemo"
			FROM ${from}
			LEFT JOIN stats st ON st.business_id = b.id
			LEFT JOIN last l ON l.business_id = b.id
			WHERE ${where}
			ORDER BY ${sort} ${order} NULLS LAST, b.id DESC
			LIMIT $3 OFFSET $4`,
			[...params, limit, skip]
		);

		return new PaginatedResponse(
			rows.map(
				(row: Record<string, unknown>): AdminBusinessRow => ({
					id: row.id as string,
					name: row.name as string,
					businessType: row.businessType as string,
					ownerEmail: (row.ownerEmail as string) ?? null,
					plan: (row.plan as string) ?? null,
					subscriptionStatus: (row.subscriptionStatus as string) ?? null,
					members: num(row.members),
					branches: num(row.branches),
					orders30d: num(row.orders30d),
					gmv30d: num(row.gmv30d),
					lastOrderAt: iso(row.lastOrderAt),
					onboardedAt: iso(row.onboardedAt),
					createdAt: iso(row.createdAt) as string,
					isDemo: Boolean(row.isDemo),
				})
			),
			num(total),
			page,
			limit
		);
	}

	async business(id: string): Promise<AdminBusinessDetail> {
		const [business] = await this.dataSource.query(
			`SELECT b.id, b.name, b.business_type AS "businessType", b.phone, b.address,
				b.tax_id AS "taxId", b.currency, b.timezone, b.onboarded_at AS "onboardedAt",
				b.created_at AS "createdAt", ${isDemoShop("b")} AS "isDemo"
			FROM business b WHERE b.id = $1 AND b.deleted_at IS NULL`,
			[id]
		);
		if (!business) throw new NotFoundException("Business not found");

		const [subscription] = await this.dataSource.query(
			`SELECT s.plan_code AS plan, p.name AS "planName", s.status, s.start_date AS "startDate",
				s.end_date AS "endDate", s.cancel_at_period_end AS "cancelAtPeriodEnd",
				(s.stripe_subscription_id IS NOT NULL) AS "hasStripe"
			FROM subscription s LEFT JOIN subscription_plan p ON p.code = s.plan_code
			WHERE s.business_id = $1 AND s.deleted_at IS NULL`,
			[id]
		);

		const [stats] = await this.dataSource.query(
			`SELECT
				COUNT(*) FILTER (WHERE o.status = ${PAID})::int AS "ordersAllTime",
				COALESCE(SUM(o.total) FILTER (WHERE o.status = ${PAID}), 0)::bigint AS "gmvAllTime",
				COUNT(*) FILTER (WHERE o.status = ${PAID} AND o.created_at >= now() - interval '30 days')::int AS "orders30d",
				COALESCE(SUM(o.total) FILTER (WHERE o.status = ${PAID} AND o.created_at >= now() - interval '30 days'), 0)::bigint AS "gmv30d",
				(SELECT COUNT(*) FROM product p WHERE p.business_id = $1 AND p.deleted_at IS NULL)::int AS products,
				(SELECT COUNT(*) FROM customer c WHERE c.business_id = $1 AND c.deleted_at IS NULL)::int AS customers
			FROM "order" o WHERE o.business_id = $1 AND o.deleted_at IS NULL`,
			[id]
		);

		const members = await this.dataSource.query(
			`SELECT m.id, m.display_name AS "displayName", COALESCE(u.email, m.email) AS email,
				m.role, m.status, (m.user_id IS NOT NULL) AS "hasAccount", m.created_at AS "createdAt"
			FROM business_member m LEFT JOIN "user" u ON u.id = m.user_id
			WHERE m.business_id = $1 AND m.deleted_at IS NULL
			ORDER BY array_position(ARRAY['OWNER','MANAGER','CASHIER','STAFF']::text[], m.role::text), m.created_at`,
			[id]
		);

		const branches = await this.dataSource.query(
			`SELECT id, name, is_default AS "isDefault", is_active AS "isActive"
			FROM branch WHERE business_id = $1 AND deleted_at IS NULL
			ORDER BY is_default DESC, created_at`,
			[id]
		);

		// The shop's own calendar days, like its dashboard.
		const series = await this.dataSource.query(
			`WITH days AS (
				SELECT generate_series(
					date_trunc('day', now() AT TIME ZONE $2) - interval '29 days',
					date_trunc('day', now() AT TIME ZONE $2),
					interval '1 day') AS day),
			o AS (
				SELECT date_trunc('day', created_at AT TIME ZONE $2) AS day,
					COUNT(*)::int AS orders, SUM(total)::bigint AS gmv
				FROM "order"
				WHERE business_id = $1 AND deleted_at IS NULL AND status = ${PAID}
					AND created_at >= (SELECT MIN(day) FROM days) AT TIME ZONE $2
				GROUP BY 1)
			SELECT to_char(days.day, 'YYYY-MM-DD') AS date,
				COALESCE(o.orders, 0) AS orders, COALESCE(o.gmv, 0) AS gmv
			FROM days LEFT JOIN o ON o.day = days.day
			ORDER BY days.day`,
			[id, business.timezone || this.timezone]
		);

		const recentOrders = await this.queryOrders(`o.business_id = $1`, [id], 20);
		const recentActivity = await this.queryAudit(`a.business_id = $1`, [id], 20, 0);

		return {
			business: {
				...business,
				onboardedAt: iso(business.onboardedAt),
				createdAt: iso(business.createdAt) as string,
				isDemo: Boolean(business.isDemo),
			},
			subscription: subscription
				? {
						...subscription,
						startDate: iso(subscription.startDate) as string,
						endDate: iso(subscription.endDate),
					}
				: null,
			stats: {
				ordersAllTime: num(stats.ordersAllTime),
				gmvAllTime: num(stats.gmvAllTime),
				orders30d: num(stats.orders30d),
				gmv30d: num(stats.gmv30d),
				products: num(stats.products),
				customers: num(stats.customers),
			},
			members: members.map((row: Record<string, unknown>) => ({
				...row,
				createdAt: iso(row.createdAt) as string,
			})),
			branches,
			series: series.map((row: Record<string, unknown>) => ({
				date: row.date as string,
				orders: num(row.orders),
				gmv: num(row.gmv),
			})),
			recentOrders,
			recentActivity,
			adminActions: await this.queryActions(`a.target_id = $1`, [id], 10, 0),
		};
	}

	async users(query: AdminUsersQueryDto): Promise<PaginatedResponse<AdminUserRow>> {
		const { page, limit, skip, sortBy, order } = getPaginationOptions(query);
		const sortable: Record<string, string> = {
			createdAt: `u.created_at`,
			email: `u.email`,
			lastSeenAt: `"lastSeenAt"`,
			shops: `shops`,
		};
		const sort = sortable[sortBy ?? "createdAt"] ?? sortable.createdAt;
		const where = `${userFilter(query.includeDemo)}
			AND ($1::text IS NULL OR u.email ILIKE $1 OR u.name ILIKE $1)`;
		const params = [contains(query.search)];

		const [{ total }] = await this.dataSource.query(
			`SELECT COUNT(*)::int AS total FROM "user" u WHERE ${where}`,
			params
		);
		const rows = await this.dataSource.query(
			`SELECT u.id, u.email, u.name, u.provider, u.is_verified AS "isVerified",
				u.is_platform_admin AS "isPlatformAdmin", u.created_at AS "createdAt",
				(u.email ILIKE ${DEMO_LIKE}) AS "isDemo",
				(SELECT COUNT(*) FROM business_member m WHERE m.user_id = u.id
					AND m.deleted_at IS NULL AND m.status = '${MemberStatus.ACTIVE}')::int AS shops,
				(SELECT MAX(rt.created_at) FROM refresh_token rt WHERE rt.user_id = u.id) AS "lastSeenAt"
			FROM "user" u
			WHERE ${where}
			ORDER BY ${sort} ${order} NULLS LAST, u.id DESC
			LIMIT $2 OFFSET $3`,
			[...params, limit, skip]
		);

		return new PaginatedResponse(
			rows.map(
				(row: Record<string, unknown>): AdminUserRow => ({
					id: row.id as string,
					email: row.email as string,
					name: row.name as string,
					provider: row.provider as string,
					isVerified: Boolean(row.isVerified),
					isPlatformAdmin: Boolean(row.isPlatformAdmin),
					isDemo: Boolean(row.isDemo),
					shops: num(row.shops),
					lastSeenAt: iso(row.lastSeenAt),
					createdAt: iso(row.createdAt) as string,
				})
			),
			num(total),
			page,
			limit
		);
	}

	async subscriptions(
		query: AdminSubscriptionsQueryDto
	): Promise<PaginatedResponse<AdminSubscriptionRow>> {
		const { page, limit, skip } = getPaginationOptions(query);
		const where = `s.deleted_at IS NULL AND s.business_id IN (SELECT id FROM shops)
			AND ($1::text IS NULL OR s.status::text = $1)
			AND ($2::text IS NULL OR s.plan_code = $2)`;
		const params = [query.status ?? null, query.plan ?? null];
		const cte = `WITH ${shopsCte(query.includeDemo)}`;

		const [{ total }] = await this.dataSource.query(
			`${cte} SELECT COUNT(*)::int AS total FROM subscription s WHERE ${where}`,
			params
		);
		const rows = await this.dataSource.query(
			`${cte}
			SELECT s.id, s.business_id AS "businessId", b.name AS "businessName",
				s.plan_code AS plan, p.name AS "planName", COALESCE(p.monthly_price, 0) AS "monthlyPrice",
				s.status, s.start_date AS "startDate", s.end_date AS "endDate",
				s.cancel_at_period_end AS "cancelAtPeriodEnd",
				(s.stripe_subscription_id IS NOT NULL) AS "hasStripe"
			FROM subscription s
			JOIN business b ON b.id = s.business_id
			LEFT JOIN subscription_plan p ON p.code = s.plan_code
			WHERE ${where}
			ORDER BY s.updated_at DESC, s.id DESC
			LIMIT $3 OFFSET $4`,
			[...params, limit, skip]
		);

		return new PaginatedResponse(
			rows.map(
				(row: Record<string, unknown>): AdminSubscriptionRow => ({
					id: row.id as string,
					businessId: row.businessId as string,
					businessName: row.businessName as string,
					plan: row.plan as string,
					planName: (row.planName as string) ?? null,
					monthlyPrice: num(row.monthlyPrice),
					status: row.status as string,
					startDate: iso(row.startDate) as string,
					endDate: iso(row.endDate),
					cancelAtPeriodEnd: Boolean(row.cancelAtPeriodEnd),
					hasStripe: Boolean(row.hasStripe),
				})
			),
			num(total),
			page,
			limit
		);
	}

	async subscriptionSummary(
		includeDemo: boolean
	): Promise<AdminSubscriptionSummary> {
		const rows = await this.dataSource.query(
			`WITH ${shopsCte(includeDemo)}
			SELECT s.status, COUNT(*)::int AS count,
				COALESCE(SUM(p.monthly_price) FILTER (WHERE s.status = '${SubscriptionStatus.ACTIVE}'), 0)::bigint AS mrr
			FROM subscription s LEFT JOIN subscription_plan p ON p.code = s.plan_code
			WHERE s.deleted_at IS NULL AND s.business_id IN (SELECT id FROM shops)
			GROUP BY s.status`
		);
		const byStatus: Record<string, number> = Object.fromEntries(
			Object.values(SubscriptionStatus).map((status) => [status, 0])
		);
		let mrr = 0;
		for (const row of rows) {
			byStatus[row.status] = num(row.count);
			mrr += num(row.mrr);
		}
		return { byStatus, mrr };
	}

	async activity(
		query: AdminActivityQueryDto
	): Promise<PaginatedResponse<AdminAuditRow>> {
		const { page, limit, skip } = getPaginationOptions(query);
		const where = `a.business_id IN (SELECT id FROM shops) AND ($1::text IS NULL OR a.action::text = $1)`;
		const params = [query.action ?? null];
		const cte = `WITH ${shopsCte(query.includeDemo)}`;

		const [{ total }] = await this.dataSource.query(
			`${cte} SELECT COUNT(*)::int AS total FROM audit_log a WHERE a.deleted_at IS NULL AND ${where}`,
			params
		);
		const data = await this.queryAudit(where, params, limit, skip, cte);
		return new PaginatedResponse(data, num(total), page, limit);
	}

	async recentOrders(query: AdminRecentOrdersQueryDto): Promise<AdminOrderRow[]> {
		return this.queryOrders(
			`o.business_id IN (SELECT id FROM shops)`,
			[],
			query.limit,
			`WITH ${shopsCte(query.includeDemo)}`
		);
	}

	async system(): Promise<AdminSystemResponse> {
		const database: AdminSystemResponse["database"] = {
			up: false,
			latencyMs: null,
			sizeMb: null,
			connections: null,
			migrations: { applied: 0, last: null, pending: null },
			tables: [],
		};
		try {
			const started = performance.now();
			await this.dataSource.query("SELECT 1");
			database.latencyMs = Math.round(performance.now() - started);
			database.up = true;

			const [info] = await this.dataSource.query(
				`SELECT pg_database_size(current_database()) AS size,
					(SELECT COUNT(*) FROM pg_stat_activity WHERE datname = current_database())::int AS connections`
			);
			database.sizeMb = mb(num(info.size));
			database.connections = num(info.connections);

			const [migrations] = await this.dataSource.query(
				`SELECT COUNT(*)::int AS applied, (SELECT name FROM migrations ORDER BY id DESC LIMIT 1) AS last
				FROM migrations`
			);
			database.migrations = {
				applied: num(migrations.applied),
				last: migrations.last ?? null,
				pending: await this.dataSource.showMigrations().catch(() => null),
			};

			const tables = await this.dataSource.query(
				`SELECT relname AS name, n_live_tup AS rows FROM pg_stat_user_tables
				WHERE relname <> 'migrations' ORDER BY n_live_tup DESC, relname`
			);
			database.tables = tables.map((row: Record<string, unknown>) => ({
				name: row.name as string,
				rows: num(row.rows),
			}));
		} catch {
			// Reported as down; the page shows whatever was gathered before the failure.
		}

		const memory = process.memoryUsage();
		const config = this.configService;
		return {
			checkedAt: new Date().toISOString(),
			api: {
				env: config.get<string>("app.env") ?? "local",
				node: process.version,
				uptimeSeconds: Math.round(process.uptime()),
				memory: {
					rssMb: mb(memory.rss),
					heapUsedMb: mb(memory.heapUsed),
					heapTotalMb: mb(memory.heapTotal),
				},
				timezone: this.timezone,
			},
			database,
			cache: await this.cacheService.ping(),
			cacheStats: await this.cacheService.stats().catch(() => null),
			// Whether each integration is configured — never the values themselves.
			integrations: {
				stripe: !!config.get<string>("billing.stripeSecretKey"),
				stripeWebhook: !!config.get<string>("billing.stripeWebhookSecret"),
				mail: !!config.get<string>("mail.resendApiKey"),
				storage:
					!!config.get<string>("storage.endpoint") &&
					!!config.get<string>("storage.bucket"),
				googleSignIn: !!config.get<string>("security.googleClientId"),
				demo: !!config.get<boolean>("demo.enabled"),
			},
		};
	}

	async user(id: string): Promise<AdminUserDetail> {
		const [user] = await this.dataSource.query(
			`SELECT u.id, u.email, u.name, u.avatar_url AS "avatarUrl", u.provider,
				u.is_verified AS "isVerified", u.is_platform_admin AS "isPlatformAdmin", u.locale,
				u.created_at AS "createdAt", (u.email ILIKE ${DEMO_LIKE}) AS "isDemo",
				(SELECT MAX(rt.created_at) FROM refresh_token rt WHERE rt.user_id = u.id) AS "lastSeenAt"
			FROM "user" u WHERE u.id = $1 AND u.deleted_at IS NULL`,
			[id]
		);
		if (!user) throw new NotFoundException("User not found");

		const memberships = await this.dataSource.query(
			`SELECT b.id AS "businessId", b.name AS "businessName", m.role, m.status,
				s.plan_code AS plan, m.created_at AS "joinedAt"
			FROM business_member m
			JOIN business b ON b.id = m.business_id AND b.deleted_at IS NULL
			LEFT JOIN subscription s ON s.business_id = b.id AND s.deleted_at IS NULL
			WHERE m.user_id = $1 AND m.deleted_at IS NULL
			ORDER BY m.created_at`,
			[id]
		);

		const sessions = await this.dataSource.query(
			`SELECT id, created_at AS "createdAt", expires_at AS "expiresAt", user_agent AS "userAgent"
			FROM refresh_token
			WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now() AND deleted_at IS NULL
			ORDER BY created_at DESC
			LIMIT 50`,
			[id]
		);

		return {
			user: {
				...user,
				isVerified: Boolean(user.isVerified),
				isPlatformAdmin: Boolean(user.isPlatformAdmin),
				isDemo: Boolean(user.isDemo),
				createdAt: iso(user.createdAt) as string,
				lastSeenAt: iso(user.lastSeenAt),
			},
			memberships: memberships.map((row: Record<string, unknown>) => ({
				businessId: row.businessId as string,
				businessName: row.businessName as string,
				role: row.role as string,
				status: row.status as string,
				plan: (row.plan as string) ?? null,
				joinedAt: iso(row.joinedAt) as string,
			})),
			sessions: sessions.map((row: Record<string, unknown>) => ({
				id: row.id as string,
				createdAt: iso(row.createdAt) as string,
				expiresAt: iso(row.expiresAt) as string,
				userAgent: (row.userAgent as string) ?? null,
			})),
			actions: await this.queryActions(`a.target_id = $1`, [id], 20, 0),
		};
	}

	/**
	 * Puts a shop on a plan by hand — what `pnpm subscription:set` does, from the monitor.
	 * Refused for a shop billed through Stripe: its next webhook would overwrite the change,
	 * so that plan is changed in Stripe instead.
	 */
	async setPlan(
		admin: AuthenticatedUser,
		businessId: string,
		dto: AdminSetPlanDto
	): Promise<AdminBusinessDetail> {
		await this.dataSource.transaction(async (manager) => {
			const [row] = await manager.query(
				`SELECT b.id, s.plan_code AS "planCode", s.status, s.end_date AS "endDate",
					s.stripe_subscription_id AS "stripeSubscriptionId"
				FROM business b
				LEFT JOIN subscription s ON s.business_id = b.id AND s.deleted_at IS NULL
				WHERE b.id = $1 AND b.deleted_at IS NULL
				FOR UPDATE OF b`,
				[businessId]
			);
			if (!row) throw new NotFoundException("Business not found");
			if (row.stripeSubscriptionId) {
				throw new ConflictException(
					"This shop is billed through Stripe; change its plan in Stripe"
				);
			}

			const endDate = dto.days ? new Date(Date.now() + dto.days * 86_400_000) : null;
			await manager.query(
				`INSERT INTO subscription (business_id, plan_code, status, start_date, end_date)
				 VALUES ($1, $2, '${SubscriptionStatus.ACTIVE}', now(), $3)
				 ON CONFLICT (business_id) WHERE deleted_at IS NULL
				 DO UPDATE SET plan_code = EXCLUDED.plan_code, status = '${SubscriptionStatus.ACTIVE}',
				               start_date = now(), end_date = EXCLUDED.end_date,
				               cancel_at_period_end = false, updated_at = now()`,
				[businessId, dto.plan, endDate]
			);
			await this.log(manager, admin, "SUBSCRIPTION_SET", "business", businessId, {
				from: row.planCode ?? null,
				fromStatus: row.status ?? null,
				to: dto.plan,
				endDate: endDate?.toISOString() ?? null,
				note: dto.note?.trim() || null,
			});
		});

		await this.entitlements.forgetSubscription(businessId);
		return this.business(businessId);
	}

	/**
	 * Signs a person out of every device: their refresh tokens are revoked, so no device can
	 * renew. An access token already issued stays valid until it expires (15 minutes).
	 */
	async revokeSessions(
		admin: AuthenticatedUser,
		userId: string,
		dto: AdminRevokeSessionsDto
	): Promise<{ revoked: number }> {
		return this.dataSource.transaction(async (manager) => {
			const [user] = await manager.query(
				`SELECT id FROM "user" WHERE id = $1 AND deleted_at IS NULL`,
				[userId]
			);
			if (!user) throw new NotFoundException("User not found");

			const [rows] = (await manager.query(
				`UPDATE refresh_token SET revoked_at = now(), revoked_reason = 'admin', updated_at = now()
				WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now() AND deleted_at IS NULL
				RETURNING id`,
				[userId]
			)) as [{ id: string }[], number];

			await this.log(manager, admin, "SESSIONS_REVOKED", "user", userId, {
				revoked: rows.length,
				note: dto.note?.trim() || null,
			});
			return { revoked: rows.length };
		});
	}

	async actions(
		query: AdminActionsQueryDto
	): Promise<PaginatedResponse<AdminActionRow>> {
		const { page, limit, skip } = getPaginationOptions(query);
		const [{ total }] = await this.dataSource.query(
			`SELECT COUNT(*)::int AS total FROM admin_action_log`
		);
		const data = await this.queryActions("true", [], limit, skip);
		return new PaginatedResponse(data, num(total), page, limit);
	}

	/** Announcements already sent, from the action log (each send is logged once). */
	async announcements(
		query: AdminActionsQueryDto
	): Promise<PaginatedResponse<AdminActionRow>> {
		const { page, limit, skip } = getPaginationOptions(query);
		const where = `a.action = 'ANNOUNCEMENT_SENT'`;
		const [{ total }] = await this.dataSource.query(
			`SELECT COUNT(*)::int AS total FROM admin_action_log a WHERE ${where}`
		);
		const data = await this.queryActions(where, [], limit, skip);
		return new PaginatedResponse(data, num(total), page, limit);
	}

	private async log(
		manager: EntityManager,
		admin: AuthenticatedUser,
		action: string,
		targetType: "business" | "user",
		targetId: string,
		payload: Record<string, unknown>
	): Promise<void> {
		await manager.query(
			`INSERT INTO admin_action_log (admin_user_id, admin_email, action, target_type, target_id, payload)
			VALUES ($1, $2, $3, $4, $5, $6)`,
			[admin.id, admin.email, action, targetType, targetId, JSON.stringify(payload)]
		);
	}

	private async queryActions(
		where: string,
		params: unknown[],
		limit: number,
		skip: number
	): Promise<AdminActionRow[]> {
		const rows = await this.dataSource.query(
			`SELECT a.id, a.admin_email AS "adminEmail", a.action, a.target_type AS "targetType",
				a.target_id AS "targetId", a.payload, a.created_at AS "createdAt",
				CASE a.target_type
					WHEN 'business' THEN (SELECT name FROM business WHERE id = a.target_id)
					WHEN 'user' THEN (SELECT email FROM "user" WHERE id = a.target_id)
				END AS "targetName"
			FROM admin_action_log a
			WHERE ${where}
			ORDER BY a.created_at DESC, a.id DESC
			LIMIT ${Number(limit)} OFFSET ${Number(skip)}`,
			params
		);
		return rows.map(
			(row: Record<string, unknown>): AdminActionRow => ({
				id: row.id as string,
				adminEmail: row.adminEmail as string,
				action: row.action as string,
				targetType: row.targetType as string,
				targetId: row.targetId as string,
				targetName: (row.targetName as string) ?? null,
				payload: (row.payload as Record<string, unknown>) ?? {},
				createdAt: iso(row.createdAt) as string,
			})
		);
	}

	private async queryOrders(
		where: string,
		params: unknown[],
		limit: number,
		cte = ""
	): Promise<AdminOrderRow[]> {
		const rows = await this.dataSource.query(
			`${cte}
			SELECT o.id, o.business_id AS "businessId", b.name AS "businessName", o.number,
				o.status, o.service_type AS "serviceType", o.employee_name AS "employeeName",
				o.total, o.created_at AS "createdAt"
			FROM "order" o JOIN business b ON b.id = o.business_id
			WHERE o.deleted_at IS NULL AND ${where}
			ORDER BY o.created_at DESC, o.id DESC
			LIMIT ${Number(limit)}`,
			params
		);
		return rows.map(
			(row: Record<string, unknown>): AdminOrderRow => ({
				id: row.id as string,
				businessId: row.businessId as string,
				businessName: row.businessName as string,
				number: num(row.number),
				status: row.status as string,
				serviceType: (row.serviceType as string) ?? null,
				employeeName: row.employeeName as string,
				total: num(row.total),
				createdAt: iso(row.createdAt) as string,
			})
		);
	}

	private async queryAudit(
		where: string,
		params: unknown[],
		limit: number,
		skip: number,
		cte = ""
	): Promise<AdminAuditRow[]> {
		const rows = await this.dataSource.query(
			`${cte}
			SELECT a.id, a.business_id AS "businessId", b.name AS "businessName",
				a.actor_name AS "actorName", a.action, a.entity, a.entity_id AS "entityId",
				a.payload, a.created_at AS "createdAt"
			FROM audit_log a JOIN business b ON b.id = a.business_id
			WHERE a.deleted_at IS NULL AND ${where}
			ORDER BY a.created_at DESC, a.id DESC
			LIMIT ${Number(limit)} OFFSET ${Number(skip)}`,
			params
		);
		return rows.map(
			(row: Record<string, unknown>): AdminAuditRow => ({
				id: row.id as string,
				businessId: row.businessId as string,
				businessName: row.businessName as string,
				actorName: row.actorName as string,
				action: row.action as string,
				entity: row.entity as string,
				entityId: row.entityId as string,
				payload: (row.payload as Record<string, unknown>) ?? {},
				createdAt: iso(row.createdAt) as string,
			})
		);
	}
}
