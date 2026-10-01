import { Branch } from "@/models/branches/entities/branch.entity";
import { BusinessMember } from "@/models/businesses/entities/business-member.entity";
import { Business } from "@/models/businesses/entities/business.entity";
import { Product } from "@/models/catalog/entities/product.entity";
import { Customer } from "@/models/customers/entities/customer.entity";
import { RealtimeService } from "@/modules/realtime/realtime.service";
import { CacheKeys } from "@/shared/cache/cache-keys";
import { CacheService } from "@/shared/cache/cache.service";
import {
	PAYMENT_MIX,
	type SaleContext,
	buildSale,
	emptyRows,
	insertSales,
	recreateDemo,
	rng,
} from "@/shared/database/seeds/demo-builder";
import {
	bangkokMidnight,
	dayTarget,
	saleTimes,
	shareBy,
} from "@/shared/database/seeds/demo-day";
import { DEMO_SHOPS, type DemoShop } from "@/shared/database/seeds/demo.data";
import { MemberRole } from "@/shared/enums/member-role.enum";
import { MemberStatus } from "@/shared/enums/member-status.enum";
import { getLocalDateString } from "@/shared/utils/date.util";
import { DEMO_EMAIL_DOMAIN } from "@/shared/utils/demo.util";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";
import { DataSource, type EntityManager } from "typeorm";

/** One lock for both jobs: a top-up never runs into a reset, and instances never double up. */
const DEMO_LOCK = 7_310_001;
/** A long gap (a deploy, a stopped server) is caught up in steps, not one burst. */
const MAX_PER_RUN = 150;

/**
 * Keeps the shared demo shops alive (`DEMO_AUTO_RESET`). Every night they are rebuilt with a
 * fresh 30 days of history — undoing whatever visitors changed — and through the day each
 * shop takes generated sales at its usual pace, so "today" on the dashboard fills up the way
 * a real shop's does. Visitors' own sales count toward the day's total.
 */
@Injectable()
export class DemoJobsService {
	private readonly logger = new Logger(DemoJobsService.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly config: ConfigService,
		private readonly realtime: RealtimeService,
		private readonly cacheService: CacheService
	) {}

	private get enabled(): boolean {
		return this.config.get<boolean>("demo.autoReset", false);
	}

	@Cron("0 0 4 * * *", { name: "demo-reset", timeZone: "Asia/Bangkok" })
	async nightly(): Promise<void> {
		if (!this.enabled) return;
		await this.withLock(async () => {
			// One transaction: a failure leaves yesterday's demo rather than none.
			const summary = await this.dataSource.transaction((m) => recreateDemo(m));
			for (const line of summary) this.logger.log(`Demo rebuilt: ${line}`);
		});
	}

	@Cron("0 */15 * * * *", { name: "demo-top-up", timeZone: "Asia/Bangkok" })
	async scheduledTopUp(): Promise<void> {
		if (!this.enabled) return;
		await this.topUp(new Date());
	}

	/** Adds the sales each demo shop should have had by `now`. Returns how many, per shop. */
	async topUp(now: Date): Promise<Record<string, number>> {
		const added: Record<string, number> = {};
		await this.withLock(async () => {
			for (const shop of DEMO_SHOPS) {
				try {
					const result = await this.dataSource.transaction((m) =>
						this.topUpShop(m, shop, now)
					);
					if (result === null) continue;
					added[shop.name] = result.added;
					await this.cacheService.bump(
						CacheKeys.dashboardVersion(result.businessId)
					);
				} catch (error) {
					this.logger.warn(
						`Demo top-up failed for ${shop.name}: ${error instanceof Error ? error.message : String(error)}`
					);
				}
			}
		});
		return added;
	}

	private async topUpShop(
		m: EntityManager,
		shop: DemoShop,
		now: Date
	): Promise<{ businessId: string; added: number } | null> {
		const [row] = (await m.query(
			`SELECT b.id FROM business b
			 JOIN business_member bm ON bm.business_id = b.id AND bm.role = $2
			 JOIN "user" u ON u.id = bm.user_id
			 WHERE b.name = $1 AND u.email LIKE $3 AND b.deleted_at IS NULL
			 LIMIT 1`,
			[shop.name, MemberRole.OWNER, `%@${DEMO_EMAIL_DOMAIN}`]
		)) as { id: string }[];
		if (!row) return null;
		const business = await m.findOneOrFail(Business, { where: { id: row.id } });

		// The kitchen screen moves on even with nobody working it: old tickets are served.
		await this.serveStale(m, business.id);

		const date = getLocalDateString(now);
		const [today] = (await m.query(
			`SELECT COUNT(*)::int AS count, MAX(created_at) AS last FROM "order"
			 WHERE business_id = $1 AND created_at >= $2 AND deleted_at IS NULL`,
			[business.id, bangkokMidnight(date)]
		)) as { count: number; last: Date | null }[];
		const target = Math.round(dayTarget(shop, date) * shareBy(shop, date, now));
		const missing = Math.min(MAX_PER_RUN, target - today.count);
		if (missing <= 0) return { businessId: business.id, added: 0 };

		const from = today.last && today.last < now ? today.last : bangkokMidnight(date);
		const random = rng(now.getTime() % 2_147_483_647);
		const times = saleTimes(shop, date, from, now, missing, random);
		if (times.length === 0) return { businessId: business.id, added: 0 };

		const ctx = await this.context(m, business, shop, random);
		if (!ctx) return null;
		const rows = emptyRows();
		const builds = times.map((at) => buildSale(ctx, rows, at));
		// Numbers from the shop's own sequence, under its row lock, as the checkout takes them.
		const [[{ order_seq: last }]] = (await m.query(
			`UPDATE "business" SET "order_seq" = "order_seq" + $2 WHERE "id" = $1 RETURNING "order_seq"`,
			[business.id, builds.length]
		)) as [[{ order_seq: number }], number];
		builds.forEach((build, i) => build(last - builds.length + 1 + i));
		await insertSales(m, rows);
		await this.cook(
			m,
			rows.orders.map((o) => o.id as string)
		);

		for (const topic of ["orders", "kitchen"] as const) {
			await this.realtime.publish(m, {
				topic,
				businessId: business.id,
				branchId: null,
			});
		}
		return { businessId: business.id, added: builds.length };
	}

	/** The shop as the seed built it: what it sells, who sells it, and its regulars. */
	private async context(
		m: EntityManager,
		business: Business,
		shop: DemoShop,
		random: () => number
	): Promise<SaleContext | null> {
		// One after another: these share the transaction's single connection.
		const branches = await m.find(Branch, {
			where: { businessId: business.id, isActive: true },
			order: { isDefault: "DESC", createdAt: "ASC" },
		});
		const members = await m.find(BusinessMember, {
			where: { businessId: business.id, status: MemberStatus.ACTIVE },
			order: { createdAt: "ASC" },
		});
		const products = await m.find(Product, {
			where: { businessId: business.id, isActive: true },
			relations: { modifierGroups: { options: true } },
			order: { createdAt: "ASC", name: "ASC" },
		});
		const customers = await m.find(Customer, {
			where: { businessId: business.id },
			order: { createdAt: "ASC" },
		});
		const sellers = members.filter((mem) => mem.role !== MemberRole.STAFF);
		if (!branches.length || !sellers.length || !products.length) return null;
		return {
			business,
			shop,
			branches,
			members,
			sellers,
			menu: products.map((product) => ({
				product,
				groups: product.modifierGroups ?? [],
			})),
			customers,
			mix: PAYMENT_MIX[shop.businessType] ?? PAYMENT_MIX.CAFE,
			random,
		};
	}

	/** New sales go through the kitchen like the seed's: just rung up is new, the rest is done. */
	private async cook(m: EntityManager, orderIds: string[]): Promise<void> {
		if (!orderIds.length) return;
		await m.query(
			`UPDATE order_item SET to_kitchen = true, prepared_at = created_at + interval '8 minutes'
			  WHERE order_id = ANY($1)`,
			[orderIds]
		);
		await m.query(
			`UPDATE "order" SET
			   kitchen_status = (CASE
			     WHEN created_at > now() - interval '8 minutes' THEN 'NEW'
			     WHEN created_at > now() - interval '20 minutes' THEN 'PREPARING'
			     WHEN created_at > now() - interval '30 minutes' THEN 'READY'
			     ELSE 'SERVED' END)::order_kitchen_status_enum,
			   kitchen_updated_at = LEAST(now(), created_at + interval '10 minutes')
			 WHERE id = ANY($1)`,
			[orderIds]
		);
		await m.query(
			`UPDATE order_item SET prepared_at = NULL
			  WHERE order_id IN (SELECT id FROM "order" WHERE id = ANY($1) AND kitchen_status IN ('NEW', 'PREPARING'))`,
			[orderIds]
		);
	}

	/** Paid walk-in tickets left open for half an hour are served; table tabs are left alone. */
	private async serveStale(m: EntityManager, businessId: string): Promise<void> {
		const stale = (await m.query(
			`UPDATE "order" SET kitchen_status = 'SERVED', kitchen_updated_at = now()
			  WHERE business_id = $1 AND status = 'PAID' AND table_session_id IS NULL
			    AND kitchen_status IN ('NEW', 'PREPARING', 'READY')
			    AND created_at < now() - interval '30 minutes'
			  RETURNING id`,
			[businessId]
		)) as [{ id: string }[], number];
		const ids = stale[0].map((r) => r.id);
		if (ids.length)
			await m.query(
				`UPDATE order_item SET prepared_at = COALESCE(prepared_at, now())
				  WHERE to_kitchen = true AND order_id = ANY($1)`,
				[ids]
			);
	}

	/** Session-level advisory lock on one dedicated connection, released whatever happens. */
	private async withLock(job: () => Promise<void>): Promise<void> {
		const runner = this.dataSource.createQueryRunner();
		await runner.connect();
		try {
			const [{ locked }] = (await runner.query(
				"SELECT pg_try_advisory_lock($1) AS locked",
				[DEMO_LOCK]
			)) as { locked: boolean }[];
			if (!locked) return;
			try {
				await job();
			} finally {
				await runner.query("SELECT pg_advisory_unlock($1)", [DEMO_LOCK]);
			}
		} catch (error) {
			this.logger.error(
				`Demo job failed: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`
			);
		} finally {
			await runner.release();
		}
	}
}
