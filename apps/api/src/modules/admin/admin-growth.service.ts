import type { AppConfig } from "@/config/configuration";
import type { AdminGrowthResponse } from "@/modules/admin/dto/admin.dto";
import { MemberRole } from "@/shared/enums/member-role.enum";
import { OrderStatus } from "@/shared/enums/order.enum";
import { PlanCode, SubscriptionStatus } from "@/shared/enums/subscription.enum";
import { DEMO_EMAIL_DOMAIN } from "@/shared/utils/demo.util";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

const DEMO_LIKE = `'%@${DEMO_EMAIL_DOMAIN}'`;
const PAID = `'${OrderStatus.PAID}'`;
const COHORT_MONTHS = 6;

const shopsCte = (includeDemo: boolean) => `shops AS (
	SELECT b.id, b.created_at FROM business b
	WHERE b.deleted_at IS NULL ${
		includeDemo
			? ""
			: `AND NOT EXISTS (
		SELECT 1 FROM business_member dm JOIN "user" du ON du.id = dm.user_id
		WHERE dm.business_id = b.id AND dm.role = '${MemberRole.OWNER}'
		  AND dm.deleted_at IS NULL AND du.email ILIKE ${DEMO_LIKE})`
	})`;

/** MRR as billing sees it now: paid plans in force (active or trialing, not past their end). */
const MRR_SQL = `SELECT COALESCE(SUM(p.monthly_price), 0)::bigint AS mrr, COUNT(*)::int AS paid
	FROM subscription s
	JOIN subscription_plan p ON p.code = s.plan_code
	WHERE s.deleted_at IS NULL AND s.business_id IN (SELECT id FROM shops)
	  AND s.plan_code <> '${PlanCode.FREE}'
	  AND s.status IN ('${SubscriptionStatus.ACTIVE}', '${SubscriptionStatus.TRIALING}')
	  AND (s.end_date IS NULL OR s.end_date > now())`;

const num = (value: unknown) => (value == null ? 0 : Number(value));

/**
 * Growth for the admin monitor. Monthly signups, active shops and cohorts come from orders
 * and sign-up dates, which have their whole history. MRR does not — a subscription row only
 * holds its present — so it is snapshotted once a day and charted from the first snapshot.
 * Snapshots always leave the demo shops out.
 */
@Injectable()
export class AdminGrowthService {
	private readonly logger = new Logger(AdminGrowthService.name);
	private readonly timezone: string;

	constructor(
		@InjectDataSource() private readonly dataSource: DataSource,
		configService: ConfigService
	) {
		this.timezone = configService.get<AppConfig>("app")?.timezone ?? "Asia/Bangkok";
	}

	@Cron("0 5 0 * * *", { name: "platform-daily-stat", timeZone: "Asia/Bangkok" })
	async snapshot(): Promise<void> {
		try {
			await this.dataSource.query(
				`WITH ${shopsCte(false)}, m AS (${MRR_SQL})
				INSERT INTO platform_daily_stat (day, mrr, paid_businesses, businesses, users)
				SELECT (now() AT TIME ZONE $1)::date, m.mrr, m.paid,
					(SELECT COUNT(*) FROM shops)::int,
					(SELECT COUNT(*) FROM "user" u WHERE u.deleted_at IS NULL AND u.email NOT ILIKE ${DEMO_LIKE})::int
				FROM m
				ON CONFLICT (day) DO UPDATE SET mrr = EXCLUDED.mrr, paid_businesses = EXCLUDED.paid_businesses,
					businesses = EXCLUDED.businesses, users = EXCLUDED.users, created_at = now()`,
				[this.timezone]
			);
		} catch (error) {
			this.logger.warn(
				`Daily stat failed: ${error instanceof Error ? error.message : error}`
			);
		}
	}

	async growth(includeDemo: boolean): Promise<AdminGrowthResponse> {
		const tz = this.timezone;
		// The first request of a day records it, so the chart never waits for midnight.
		const [today] = await this.dataSource.query(
			`SELECT 1 FROM platform_daily_stat WHERE day = (now() AT TIME ZONE $1)::date`,
			[tz]
		);
		if (!today) await this.snapshot();

		const months = await this.dataSource.query(
			`WITH ${shopsCte(includeDemo)},
			months AS (
				SELECT generate_series(
					date_trunc('month', now() AT TIME ZONE $1) - interval '11 months',
					date_trunc('month', now() AT TIME ZONE $1),
					interval '1 month') AS m),
			since AS (SELECT MIN(m) AT TIME ZONE $1 AS at FROM months),
			o AS (
				SELECT date_trunc('month', created_at AT TIME ZONE $1) AS m,
					COUNT(DISTINCT business_id)::int AS active, SUM(total)::bigint AS gmv
				FROM "order"
				WHERE deleted_at IS NULL AND status = ${PAID}
					AND business_id IN (SELECT id FROM shops) AND created_at >= (SELECT at FROM since)
				GROUP BY 1),
			nb AS (
				SELECT date_trunc('month', created_at AT TIME ZONE $1) AS m, COUNT(*)::int AS n
				FROM shops WHERE created_at >= (SELECT at FROM since) GROUP BY 1),
			su AS (
				SELECT date_trunc('month', u.created_at AT TIME ZONE $1) AS m, COUNT(*)::int AS n
				FROM "user" u
				WHERE u.deleted_at IS NULL ${includeDemo ? "" : `AND u.email NOT ILIKE ${DEMO_LIKE}`}
					AND u.created_at >= (SELECT at FROM since)
				GROUP BY 1)
			SELECT to_char(months.m, 'YYYY-MM') AS month,
				COALESCE(nb.n, 0) AS "newBusinesses", COALESCE(su.n, 0) AS signups,
				COALESCE(o.active, 0) AS "activeBusinesses", COALESCE(o.gmv, 0) AS gmv
			FROM months
			LEFT JOIN o ON o.m = months.m
			LEFT JOIN nb ON nb.m = months.m
			LEFT JOIN su ON su.m = months.m
			ORDER BY months.m`,
			[tz]
		);

		const cohortRows = await this.dataSource.query(
			`WITH ${shopsCte(includeDemo)},
			start AS (SELECT date_trunc('month', now() AT TIME ZONE $1) - make_interval(months => $2::int - 1) AS m),
			cohort AS (
				SELECT id, date_trunc('month', created_at AT TIME ZONE $1) AS m
				FROM shops WHERE created_at >= (SELECT m FROM start) AT TIME ZONE $1),
			act AS (
				SELECT DISTINCT business_id, date_trunc('month', created_at AT TIME ZONE $1) AS m
				FROM "order"
				WHERE deleted_at IS NULL AND status = ${PAID} AND business_id IN (SELECT id FROM cohort))
			SELECT to_char(c.m, 'YYYY-MM') AS month, k.k,
				COUNT(DISTINCT c.id)::int AS size, COUNT(DISTINCT a.business_id)::int AS active
			FROM cohort c
			CROSS JOIN generate_series(0, $2::int - 1) AS k(k)
			LEFT JOIN act a ON a.business_id = c.id AND a.m = c.m + make_interval(months => k.k)
			WHERE c.m + make_interval(months => k.k) <= date_trunc('month', now() AT TIME ZONE $1)
			GROUP BY c.m, k.k
			ORDER BY c.m, k.k`,
			[tz, COHORT_MONTHS]
		);
		const cohorts = new Map<
			string,
			{ month: string; size: number; active: number[] }
		>();
		for (const row of cohortRows as {
			month: string;
			k: number;
			size: number;
			active: number;
		}[]) {
			const cohort = cohorts.get(row.month) ?? {
				month: row.month,
				size: row.size,
				active: [],
			};
			cohort.active[row.k] = num(row.active);
			cohorts.set(row.month, cohort);
		}

		const daily = await this.dataSource.query(
			`SELECT to_char(day, 'YYYY-MM-DD') AS day, mrr, paid_businesses AS "paidBusinesses", businesses, users
			FROM platform_daily_stat
			WHERE day >= (now() AT TIME ZONE $1)::date - 179
			ORDER BY day`,
			[tz]
		);

		const [current] = await this.dataSource.query(
			`WITH ${shopsCte(includeDemo)} ${MRR_SQL}`
		);

		return {
			months: months.map((row: Record<string, unknown>) => ({
				month: row.month as string,
				newBusinesses: num(row.newBusinesses),
				signups: num(row.signups),
				activeBusinesses: num(row.activeBusinesses),
				gmv: num(row.gmv),
			})),
			cohorts: [...cohorts.values()],
			daily: daily.map((row: Record<string, unknown>) => ({
				day: row.day as string,
				mrr: num(row.mrr),
				paidBusinesses: num(row.paidBusinesses),
				businesses: num(row.businesses),
				users: num(row.users),
			})),
			now: { mrr: num(current.mrr), paidBusinesses: num(current.paid) },
		};
	}
}
