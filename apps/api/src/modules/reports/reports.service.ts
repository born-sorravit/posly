import { BusinessRepository } from "@/models/businesses/business.repository";
import { ProductRepository } from "@/models/catalog/product.repository";
import { CacheKeys } from "@/shared/cache/cache-keys";
import { CacheService } from "@/shared/cache/cache.service";
import type { ResolvedMembership } from "@/shared/decorators/current-membership.decorator";
import { OrderStatus } from "@/shared/enums/order.enum";
import { Injectable, NotFoundException } from "@nestjs/common";
import { DataSource } from "typeorm";

export type ReportRange = "today" | "yesterday" | "7d" | "30d";

/**
 * How long a dashboard answer is reused. The web polls it every minute from every open tab,
 * so this must outlast a poll to save anything. Whatever changes the figures (a sale, refund,
 * cancellation, expense, product or stock change, the shop's settings, its branches) bumps
 * the shop's version and retires the answer at once; the TTL only bounds what moves with the
 * clock alone: "yesterday by now" and the day rolling over at midnight, each at most this late.
 */
const DASHBOARD_TTL_SECONDS = 300;

const DAYS: Record<ReportRange, number> = {
	today: 1,
	yesterday: 1,
	"7d": 7,
	"30d": 30,
};

interface Window {
	from: Date;
	to: Date;
	previousFrom: Date;
}

/** Null when there is nothing to compare against — "+100%" over a zero day is noise. */
const change = (current: number, previous: number): number | null =>
	previous === 0
		? null
		: Math.round(((current - previous) / previous) * 1000) / 1000;

/**
 * The owner's numbers (plan §8, §20).
 *
 * Every day boundary is the **business's** local midnight, computed in SQL with
 * `AT TIME ZONE` — "today" for a Bangkok cafe is not a UTC day. Revenue counts PAID orders
 * only, so a refunded or cancelled sale drops out of every figure the moment it is reversed.
 * Estimated profit is revenue minus the cost snapshot taken at sale time; expenses join it
 * in phase 2.
 */
@Injectable()
export class ReportsService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly businessRepository: BusinessRepository,
		private readonly productRepository: ProductRepository,
		private readonly cacheService: CacheService
	) {}

	async dashboard(membership: ResolvedMembership, range: ReportRange) {
		const version = await this.cacheService.version(
			CacheKeys.dashboardVersion(membership.businessId)
		);
		// A branch-limited member sees only their branches' figures: the scope is in the key.
		const scope = membership.branchIds
			? [...membership.branchIds].sort().join(",")
			: "all";
		return this.cacheService.remember(
			`dashboard:${membership.businessId}:${version}:${range}:${scope}`,
			() => this.computeDashboard(membership, range),
			DASHBOARD_TTL_SECONDS
		);
	}

	private async computeDashboard(
		membership: ResolvedMembership,
		range: ReportRange
	) {
		const business = await this.businessRepository.findOne({
			where: { id: membership.businessId },
		});
		if (!business) throw new NotFoundException("Business not found");
		const tz = business.timezone;
		const window = await this.window(tz, range);
		const scope = this.branchScope(membership);

		// "Today so far" against "yesterday up to this time", not against all of yesterday —
		// otherwise every morning looks like a collapse in sales.
		const partial = range === "today";
		const now = new Date();
		const previousTo = partial
			? new Date(
					window.previousFrom.getTime() + (now.getTime() - window.from.getTime())
				)
			: window.from;
		const [current, previous, expenses, previousExpenses] = await Promise.all([
			this.totals(business.id, window.from, partial ? now : window.to, scope),
			this.totals(business.id, window.previousFrom, previousTo, scope),
			this.expenses(business.id, tz, window.from, window.to),
			this.expenses(business.id, tz, window.previousFrom, window.from),
		]);
		const profit = current.revenue - current.cost - expenses;
		const previousProfit = previous.revenue - previous.cost - previousExpenses;

		const hourly = range === "today" || range === "yesterday";
		const series = await this.series(business.id, tz, window, hourly, scope);

		const [topProducts, lowSelling, paymentBreakdown, employees, lowStock] =
			await Promise.all([
				this.products(business.id, window, scope, "DESC"),
				this.products(business.id, window, scope, "ASC"),
				this.payments(business.id, window, scope),
				this.employees(business.id, window, scope),
				this.lowStock(business.id),
			]);

		const average = (t: { revenue: number; orders: number }) =>
			t.orders === 0 ? 0 : Math.round(t.revenue / t.orders);

		return {
			range,
			from: window.from.toISOString(),
			to: window.to.toISOString(),
			metrics: {
				revenue: current.revenue,
				revenueChange: change(current.revenue, previous.revenue),
				orders: current.orders,
				ordersChange: change(current.orders, previous.orders),
				averageOrder: average(current),
				averageOrderChange: change(average(current), average(previous)),
				// Gross profit: sales minus the cost snapshot taken at each sale. The dashboard
				// shows this — it is what a day or an hour actually earned.
				cost: current.cost,
				grossProfit: current.revenue - current.cost,
				grossProfitChange: change(
					current.revenue - current.cost,
					previous.revenue - previous.cost
				),
				// Minus the expenses recorded for the same days (plan §19). Meaningful over a
				// month; over a single day one rent payment swamps it, so only reports show it.
				expenses,
				estimatedProfit: profit,
				profitChange: change(profit, previousProfit),
				// The comparison period's own figures (for "today", yesterday up to this time), so
				// a card can say "yesterday by now: ฿7,720" instead of a bare "-98.9%".
				previousRevenue: previous.revenue,
				previousOrders: previous.orders,
				previousAverageOrder: average(previous),
				previousGrossProfit: previous.revenue - previous.cost,
				previousEstimatedProfit: previousProfit,
			},
			series,
			topProducts,
			lowSelling,
			paymentBreakdown,
			employees,
			lowStock,
		};
	}

	/** [from, to) for the range in the shop's timezone, plus the equal-length period before it. */
	private async window(tz: string, range: ReportRange): Promise<Window> {
		const days = DAYS[range];
		const endOffset = range === "yesterday" ? 0 : 1;
		const [row] = (await this.dataSource.query(
			`SELECT
				(date_trunc('day', now() AT TIME ZONE $1) + make_interval(days => $2::int - $3::int)) AT TIME ZONE $1 AS "from",
				(date_trunc('day', now() AT TIME ZONE $1) + make_interval(days => $2::int)) AT TIME ZONE $1 AS "to",
				(date_trunc('day', now() AT TIME ZONE $1) + make_interval(days => $2::int - 2 * $3::int)) AT TIME ZONE $1 AS "previousFrom"`,
			[tz, endOffset, days]
		)) as [Window];
		return {
			from: new Date(row.from),
			to: new Date(row.to),
			previousFrom: new Date(row.previousFrom),
		};
	}

	private branchScope(membership: ResolvedMembership): string[] | null {
		return membership.branchIds;
	}

	private scopeSql(scope: string[] | null, param: number): string {
		return scope ? `AND o.branch_id = ANY($${param}::uuid[])` : "";
	}

	private params(base: unknown[], scope: string[] | null): unknown[] {
		return scope ? [...base, scope] : base;
	}

	private async totals(
		businessId: string,
		from: Date,
		to: Date,
		scope: string[] | null
	) {
		const [row] = (await this.dataSource.query(
			`SELECT COALESCE(SUM(o.total), 0)::bigint AS revenue,
				COUNT(*)::int AS orders,
				COALESCE(SUM(o.total_cost), 0)::bigint AS cost
			FROM "order" o
			WHERE o.business_id = $1 AND o.status = $2 AND o.created_at >= $3 AND o.created_at < $4
				AND o.deleted_at IS NULL ${this.scopeSql(scope, 5)}`,
			this.params([businessId, OrderStatus.PAID, from, to], scope)
		)) as [{ revenue: string; orders: number; cost: string }];
		return {
			revenue: Number(row.revenue),
			orders: row.orders,
			cost: Number(row.cost),
		};
	}

	/**
	 * Expenses on the shop-local days the window covers. They are business-wide — a bill is
	 * not rung up at a till — so they are not narrowed by a member's branch scope.
	 */
	private async expenses(
		businessId: string,
		tz: string,
		from: Date,
		to: Date
	): Promise<number> {
		const [row] = (await this.dataSource.query(
			`SELECT COALESCE(SUM(amount), 0)::bigint AS sum FROM expense
			 WHERE business_id = $1 AND deleted_at IS NULL
			   AND spent_on >= ($2::timestamptz AT TIME ZONE $4)::date
			   AND spent_on < ($3::timestamptz AT TIME ZONE $4)::date`,
			[businessId, from, to, tz]
		)) as [{ sum: string }];
		return Number(row.sum);
	}

	/** Every bucket, including the empty ones, so the chart has no gaps. */
	private async series(
		businessId: string,
		tz: string,
		window: Window,
		hourly: boolean,
		scope: string[] | null
	) {
		const unit = hourly ? "hour" : "day";
		const rows = (await this.dataSource.query(
			`WITH buckets AS (
				SELECT generate_series(
					date_trunc('${unit}', $2::timestamptz AT TIME ZONE $4),
					date_trunc('${unit}', ($3::timestamptz - interval '1 second') AT TIME ZONE $4),
					interval '1 ${unit}'
				) AS bucket
			)
			SELECT to_char(b.bucket, 'YYYY-MM-DD"T"HH24') AS bucket,
				COALESCE(SUM(o.total), 0)::bigint AS revenue,
				COUNT(o.id)::int AS orders
			FROM buckets b
			LEFT JOIN "order" o
				ON date_trunc('${unit}', o.created_at AT TIME ZONE $4) = b.bucket
				AND o.business_id = $1 AND o.status = '${OrderStatus.PAID}' AND o.deleted_at IS NULL
				${this.scopeSql(scope, 5)}
			GROUP BY b.bucket ORDER BY b.bucket`,
			this.params([businessId, window.from, window.to, tz], scope)
		)) as { bucket: string; revenue: string; orders: number }[];

		// `bucket` is formatted in SQL as local wall-clock text ("2026-09-28T09"). Returning the
		// timestamp itself would let node-postgres reinterpret it in the server's own timezone.
		return rows.map((r) => {
			const date = r.bucket.slice(0, 10);
			return {
				label: hourly ? r.bucket.slice(11, 13) : String(Number(date.slice(8, 10))),
				date,
				revenue: Number(r.revenue),
				orders: r.orders,
			};
		});
	}

	private async products(
		businessId: string,
		window: Window,
		scope: string[] | null,
		dir: "ASC" | "DESC"
	) {
		const rows = (await this.dataSource.query(
			`SELECT i.name, MAX(i.art) AS art, SUM(i.quantity)::int AS sold, SUM(i.line_total)::bigint AS revenue
			FROM order_item i JOIN "order" o ON o.id = i.order_id
			WHERE o.business_id = $1 AND o.status = '${OrderStatus.PAID}' AND o.created_at >= $2 AND o.created_at < $3
				AND o.deleted_at IS NULL ${this.scopeSql(scope, 4)}
			GROUP BY i.name ORDER BY sold ${dir}, revenue ${dir} LIMIT 5`,
			this.params([businessId, window.from, window.to], scope)
		)) as { name: string; art: string; sold: number; revenue: string }[];
		return rows.map((r) => ({ ...r, revenue: Number(r.revenue) }));
	}

	private async payments(
		businessId: string,
		window: Window,
		scope: string[] | null
	) {
		const rows = (await this.dataSource.query(
			`SELECT p.method, SUM(p.amount)::bigint AS amount, COUNT(*)::int AS count
			FROM payment p JOIN "order" o ON o.id = p.order_id
			WHERE o.business_id = $1 AND o.status = '${OrderStatus.PAID}' AND o.created_at >= $2 AND o.created_at < $3
				AND o.deleted_at IS NULL ${this.scopeSql(scope, 4)}
			GROUP BY p.method ORDER BY amount DESC`,
			this.params([businessId, window.from, window.to], scope)
		)) as { method: string; amount: string; count: number }[];
		return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
	}

	/** Per employee: sales, refunds and discounts over the window. */
	private async employees(
		businessId: string,
		window: Window,
		scope: string[] | null
	) {
		const rows = (await this.dataSource.query(
			`SELECT o.employee_name AS name,
				COUNT(*) FILTER (WHERE o.status = '${OrderStatus.PAID}')::int AS orders,
				COALESCE(SUM(o.total) FILTER (WHERE o.status = '${OrderStatus.PAID}'), 0)::bigint AS revenue,
				COALESCE(SUM(o.total) FILTER (WHERE o.status = '${OrderStatus.REFUNDED}'), 0)::bigint AS refunds,
				COALESCE(SUM(o.discount) FILTER (WHERE o.status = '${OrderStatus.PAID}'), 0)::bigint AS discounts
			FROM "order" o
			WHERE o.business_id = $1 AND o.created_at >= $2 AND o.created_at < $3 AND o.deleted_at IS NULL
				${this.scopeSql(scope, 4)}
			GROUP BY o.employee_name ORDER BY revenue DESC`,
			this.params([businessId, window.from, window.to], scope)
		)) as {
			name: string;
			orders: number;
			revenue: string;
			refunds: string;
			discounts: string;
		}[];
		return rows.map((r) => ({
			name: r.name,
			orders: r.orders,
			revenue: Number(r.revenue),
			refunds: Number(r.refunds),
			discounts: Number(r.discounts),
		}));
	}

	private async lowStock(businessId: string) {
		const products = await this.productRepository
			.createQueryBuilder("p")
			.where(
				"p.business_id = :businessId AND p.track_stock = true AND p.is_active = true",
				{ businessId }
			)
			.andWhere(
				"(p.stock <= 0 OR (p.low_stock_at IS NOT NULL AND p.stock <= p.low_stock_at))"
			)
			.orderBy("p.stock", "ASC")
			.limit(5)
			.getMany();
		return products.map((p) => ({
			id: p.id,
			name: p.name,
			stock: p.stock ?? 0,
			unit: p.unit,
			tone: (p.stock ?? 0) <= 0 ? ("danger" as const) : ("warning" as const),
		}));
	}
}
