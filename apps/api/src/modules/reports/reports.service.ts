import { BusinessRepository } from "@/models/businesses/business.repository";
import { ProductRepository } from "@/models/catalog/product.repository";
import { CacheKeys } from "@/shared/cache/cache-keys";
import { CacheService } from "@/shared/cache/cache.service";
import type { ResolvedMembership } from "@/shared/decorators/current-membership.decorator";
import type { ReportQueryDto } from "@/modules/reports/dto/report.dto";
import { EntitlementsService } from "@/modules/subscriptions/entitlements.service";
import { OrderStatus } from "@/shared/enums/order.enum";
import { Feature } from "@/shared/enums/subscription.enum";
import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
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

/** The longest custom range: a year, plus the leap day. */
const MAX_CUSTOM_DAYS = 366;

interface Window {
	from: Date;
	to: Date;
	previousFrom: Date;
	previousTo: Date;
	/** Local days covered. */
	days: number;
	/** "Today so far": the figures stop at now, and so does the comparison. */
	partial: boolean;
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
		private readonly cacheService: CacheService,
		private readonly entitlements: EntitlementsService
	) {}

	async dashboard(membership: ResolvedMembership, query: ReportQueryDto) {
		await this.assertAdvanced(membership, query);
		return this.cached(membership, "dashboard", query, () =>
			this.computeDashboard(membership, query)
		);
	}

	/**
	 * A custom range or a year-on-year comparison is the Advanced report (Pro and up); the
	 * presets against the previous period are for every plan.
	 */
	private async assertAdvanced(
		membership: ResolvedMembership,
		query: ReportQueryDto
	) {
		const advanced = Boolean(query.from || query.to) || query.compare === "year";
		if (!advanced) return;
		if (
			!(await this.entitlements.hasFeature(
				membership.businessId,
				Feature.ADVANCED_REPORT
			))
		) {
			throw new ForbiddenException(
				`Your plan does not include ${Feature.ADVANCED_REPORT}`
			);
		}
	}

	/** Behind the shop's dashboard version: a sale or an expense retires every cached report. */
	private async cached<T>(
		membership: ResolvedMembership,
		kind: string,
		query: ReportQueryDto,
		compute: () => Promise<T>
	): Promise<T> {
		const version = await this.cacheService.version(
			CacheKeys.dashboardVersion(membership.businessId)
		);
		// A branch-limited member sees only their branches' figures: the scope is in the key.
		const scope = membership.branchIds
			? [...membership.branchIds].sort().join(",")
			: "all";
		const window = query.from ? `${query.from}_${query.to}` : query.range;
		return this.cacheService.remember(
			`${kind}:${membership.businessId}:${version}:${window}:${query.compare}:${scope}`,
			compute,
			DASHBOARD_TTL_SECONDS
		);
	}

	private async computeDashboard(
		membership: ResolvedMembership,
		query: ReportQueryDto
	) {
		const business = await this.businessRepository.findOne({
			where: { id: membership.businessId },
		});
		if (!business) throw new NotFoundException("Business not found");
		const tz = business.timezone;
		const window = await this.window(tz, query);
		const scope = this.branchScope(membership);
		const range = query.from ? "custom" : query.range;

		// "Today so far" against the same stretch of the comparison day — otherwise every
		// morning looks like a collapse in sales. `window.previousTo` already stops there.
		const partial = window.partial;
		const now = new Date();
		const [current, previous, expenses, previousExpenses] = await Promise.all([
			this.totals(business.id, window.from, partial ? now : window.to, scope),
			this.totals(business.id, window.previousFrom, window.previousTo, scope),
			this.expenses(business.id, tz, window.from, window.to),
			// Expenses are by whole day: the comparison's days in full, even when its sales stop
			// at "this time of day".
			this.expenses(
				business.id,
				tz,
				window.previousFrom,
				partial
					? new Date(
							window.previousFrom.getTime() +
								(window.to.getTime() - window.from.getTime())
						)
					: window.previousTo
			),
		]);
		const profit = current.revenue - current.cost - expenses;
		const previousProfit = previous.revenue - previous.cost - previousExpenses;

		const hourly = window.days === 1;
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
			compare: query.compare,
			from: window.from.toISOString(),
			to: window.to.toISOString(),
			previousFrom: window.previousFrom.toISOString(),
			previousTo: window.previousTo.toISOString(),
			days: window.days,
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

	/**
	 * [from, to) in the shop's timezone, and the period it is compared with: the equal-length
	 * stretch just before, or the same dates a year earlier. A preset "today" is partial —
	 * it runs to now, and its comparison runs to the same time of that day.
	 */
	private async window(tz: string, query: ReportQueryDto): Promise<Window> {
		let from: string;
		let to: string;
		let partial = false;
		if (query.from || query.to) {
			if (!query.from || !query.to) {
				throw new BadRequestException("A custom range needs both from and to");
			}
			if (query.from > query.to) throw new BadRequestException("from is after to");
			const [bounds] = (await this.dataSource.query(
				`SELECT $2::date::timestamp AT TIME ZONE $1 AS "from", ($3::date + 1)::timestamp AT TIME ZONE $1 AS "to",
					($3::date - $2::date + 1)::int AS days`,
				[tz, query.from, query.to]
			)) as [{ from: string; to: string; days: number }];
			if (bounds.days > MAX_CUSTOM_DAYS) {
				throw new BadRequestException(
					`A custom range is at most ${MAX_CUSTOM_DAYS} days`
				);
			}
			from = bounds.from;
			to = bounds.to;
		} else {
			const days = DAYS[query.range];
			const endOffset = query.range === "yesterday" ? 0 : 1;
			const [bounds] = (await this.dataSource.query(
				`SELECT
					(date_trunc('day', now() AT TIME ZONE $1) + make_interval(days => $2::int - $3::int)) AT TIME ZONE $1 AS "from",
					(date_trunc('day', now() AT TIME ZONE $1) + make_interval(days => $2::int)) AT TIME ZONE $1 AS "to"`,
				[tz, endOffset, days]
			)) as [{ from: string; to: string }];
			from = bounds.from;
			to = bounds.to;
			partial = query.range === "today";
		}

		// The comparison, shifted in local time so a month or a year lands on the same dates.
		const [row] = (await this.dataSource.query(
			`WITH w AS (SELECT $2::timestamptz AS f, $3::timestamptz AS t,
					CASE WHEN $5 THEN now() ELSE $3::timestamptz END AS stop)
			SELECT
				CASE WHEN $4 = 'year'
					THEN ((w.f AT TIME ZONE $1) - interval '1 year') AT TIME ZONE $1
					ELSE w.f - (w.t - w.f) END AS "previousFrom",
				CASE WHEN $4 = 'year'
					THEN ((w.stop AT TIME ZONE $1) - interval '1 year') AT TIME ZONE $1
					ELSE w.f - (w.t - w.f) + (w.stop - w.f) END AS "previousTo",
				round(extract(epoch FROM (w.t - w.f)) / 86400)::int AS days
			FROM w`,
			[tz, from, to, query.compare, partial]
		)) as [{ previousFrom: string; previousTo: string; days: number }];
		return {
			from: new Date(from),
			to: new Date(to),
			previousFrom: new Date(row.previousFrom),
			previousTo: new Date(row.previousTo),
			days: row.days,
			partial,
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

	/**
	 * The Advanced report, over the same window as the dashboard: when the shop sells, what
	 * earns it money (not only what sells), and who its regulars are.
	 */
	async insights(membership: ResolvedMembership, query: ReportQueryDto) {
		return this.cached(membership, "insights", query, () =>
			this.computeInsights(membership, query)
		);
	}

	private async computeInsights(
		membership: ResolvedMembership,
		query: ReportQueryDto
	) {
		const business = await this.businessRepository.findOne({
			where: { id: membership.businessId },
		});
		if (!business) throw new NotFoundException("Business not found");
		const tz = business.timezone;
		const window = await this.window(tz, query);
		const scope = this.branchScope(membership);
		const [heatmap, products, categories, customers] = await Promise.all([
			this.heatmap(business.id, tz, window, scope),
			this.productProfit(business.id, window, scope),
			this.categoryProfit(business.id, window, scope),
			this.customers(business.id, window, scope),
		]);
		return {
			range: query.from ? "custom" : query.range,
			from: window.from.toISOString(),
			to: window.to.toISOString(),
			days: window.days,
			heatmap,
			products,
			categories,
			customers,
		};
	}

	/**
	 * Paid orders by local weekday × hour. `weeks` is how many of each weekday the window
	 * holds, so a cell can be read as a typical such hour rather than a raw total.
	 */
	private async heatmap(
		businessId: string,
		tz: string,
		window: Window,
		scope: string[] | null
	) {
		const rows = (await this.dataSource.query(
			`SELECT extract(isodow FROM o.created_at AT TIME ZONE $4)::int AS dow,
				extract(hour FROM o.created_at AT TIME ZONE $4)::int AS hour,
				COUNT(*)::int AS orders, COALESCE(SUM(o.total), 0)::bigint AS revenue
			FROM "order" o
			WHERE o.business_id = $1 AND o.status = '${OrderStatus.PAID}' AND o.deleted_at IS NULL
				AND o.created_at >= $2 AND o.created_at < $3 ${this.scopeSql(scope, 5)}
			GROUP BY 1, 2`,
			this.params([businessId, window.from, window.to, tz], scope)
		)) as { dow: number; hour: number; orders: number; revenue: string }[];
		const [{ weeks }] = (await this.dataSource.query(
			`SELECT array_agg(n ORDER BY dow)::int[] AS weeks FROM (
				SELECT extract(isodow FROM d)::int AS dow, COUNT(*)::int AS n
				FROM generate_series(($1::timestamptz AT TIME ZONE $3)::date,
					(($2::timestamptz - interval '1 second') AT TIME ZONE $3)::date, interval '1 day') AS d
				GROUP BY 1) x`,
			[window.from, window.to, tz]
		)) as [{ weeks: number[] }];
		return {
			// Monday first, as a Thai week is read; hours 0–23 in the shop's own time.
			cells: rows.map((r) => ({
				dow: r.dow,
				hour: r.hour,
				orders: r.orders,
				revenue: Number(r.revenue),
			})),
			weeks,
		};
	}

	/**
	 * Per product: what it sold, what that cost at the time (the cost snapshot on each line),
	 * and the difference. Order-level discounts are not spread over lines, so these margins
	 * are before discounts — the page says so.
	 */
	private async productProfit(
		businessId: string,
		window: Window,
		scope: string[] | null
	) {
		const rows = (await this.dataSource.query(
			`SELECT i.product_id AS "productId", i.name, MAX(i.art) AS art,
				MAX(c.name) AS category, SUM(i.quantity)::int AS sold,
				SUM(i.line_total)::bigint AS revenue, SUM(i.unit_cost * i.quantity)::bigint AS cost
			FROM order_item i
			JOIN "order" o ON o.id = i.order_id
			LEFT JOIN product p ON p.id = i.product_id
			LEFT JOIN category c ON c.id = p.category_id
			WHERE o.business_id = $1 AND o.status = '${OrderStatus.PAID}' AND o.deleted_at IS NULL
				AND o.created_at >= $2 AND o.created_at < $3 ${this.scopeSql(scope, 4)}
			GROUP BY i.product_id, i.name
			ORDER BY revenue DESC
			LIMIT 100`,
			this.params([businessId, window.from, window.to], scope)
		)) as {
			productId: string | null;
			name: string;
			art: string | null;
			category: string | null;
			sold: number;
			revenue: string;
			cost: string;
		}[];
		return rows.map((r) => {
			const revenue = Number(r.revenue);
			const cost = Number(r.cost);
			return { ...r, revenue, cost, profit: revenue - cost };
		});
	}

	/** The same, by the product's current category ("no category" is null). */
	private async categoryProfit(
		businessId: string,
		window: Window,
		scope: string[] | null
	) {
		const rows = (await this.dataSource.query(
			`SELECT c.id, c.name, MAX(c.icon) AS icon, SUM(i.quantity)::int AS sold,
				SUM(i.line_total)::bigint AS revenue, SUM(i.unit_cost * i.quantity)::bigint AS cost
			FROM order_item i
			JOIN "order" o ON o.id = i.order_id
			LEFT JOIN product p ON p.id = i.product_id
			LEFT JOIN category c ON c.id = p.category_id
			WHERE o.business_id = $1 AND o.status = '${OrderStatus.PAID}' AND o.deleted_at IS NULL
				AND o.created_at >= $2 AND o.created_at < $3 ${this.scopeSql(scope, 4)}
			GROUP BY c.id, c.name
			ORDER BY revenue DESC`,
			this.params([businessId, window.from, window.to], scope)
		)) as {
			id: string | null;
			name: string | null;
			icon: string | null;
			sold: number;
			revenue: string;
			cost: string;
		}[];
		return rows.map((r) => {
			const revenue = Number(r.revenue);
			const cost = Number(r.cost);
			return { ...r, revenue, cost, profit: revenue - cost };
		});
	}

	/**
	 * Customers, as far as orders are linked to one. "New" had their first paid order ever in
	 * the window; "returning" had one before it. Lapsed regulars bought at least twice but not
	 * in the last 30 days.
	 */
	private async customers(
		businessId: string,
		window: Window,
		scope: string[] | null
	) {
		const scoped = this.scopeSql(scope, 4);
		const [summary] = (await this.dataSource.query(
			`WITH w AS (
				SELECT o.customer_id, o.total FROM "order" o
				WHERE o.business_id = $1 AND o.status = '${OrderStatus.PAID}' AND o.deleted_at IS NULL
					AND o.created_at >= $2 AND o.created_at < $3 ${scoped}),
			firsts AS (
				SELECT o.customer_id, MIN(o.created_at) AS first
				FROM "order" o
				WHERE o.business_id = $1 AND o.status = '${OrderStatus.PAID}' AND o.deleted_at IS NULL
					AND o.customer_id IN (SELECT customer_id FROM w WHERE customer_id IS NOT NULL)
				GROUP BY o.customer_id)
			SELECT
				COUNT(*)::int AS orders,
				COUNT(*) FILTER (WHERE customer_id IS NOT NULL)::int AS "identifiedOrders",
				COALESCE(SUM(total) FILTER (WHERE customer_id IS NOT NULL), 0)::bigint AS "identifiedRevenue",
				COALESCE(SUM(total), 0)::bigint AS revenue,
				COUNT(DISTINCT customer_id)::int AS customers,
				(SELECT COUNT(*) FROM firsts WHERE first >= $2)::int AS "newCustomers"
			FROM w`,
			this.params([businessId, window.from, window.to], scope)
		)) as [Record<string, string | number>];

		const top = (await this.dataSource.query(
			`SELECT c.id, c.name, c.phone, COUNT(*)::int AS orders, SUM(o.total)::bigint AS revenue,
				MAX(o.created_at) AS "lastOrderAt"
			FROM "order" o JOIN customer c ON c.id = o.customer_id
			WHERE o.business_id = $1 AND o.status = '${OrderStatus.PAID}' AND o.deleted_at IS NULL
				AND o.created_at >= $2 AND o.created_at < $3 ${scoped}
			GROUP BY c.id, c.name, c.phone
			ORDER BY revenue DESC
			LIMIT 10`,
			this.params([businessId, window.from, window.to], scope)
		)) as {
			id: string;
			name: string;
			phone: string | null;
			orders: number;
			revenue: string;
			lastOrderAt: string;
		}[];

		const lapsed = (await this.dataSource.query(
			`SELECT c.id, c.name, c.phone, COUNT(*)::int AS orders, SUM(o.total)::bigint AS revenue,
				MAX(o.created_at) AS "lastOrderAt"
			FROM "order" o JOIN customer c ON c.id = o.customer_id
			WHERE o.business_id = $1 AND o.status = '${OrderStatus.PAID}' AND o.deleted_at IS NULL
				AND c.deleted_at IS NULL ${this.scopeSql(scope, 2)}
			GROUP BY c.id, c.name, c.phone
			HAVING COUNT(*) >= 2 AND MAX(o.created_at) < now() - interval '30 days'
			ORDER BY revenue DESC
			LIMIT 10`,
			this.params([businessId], scope)
		)) as {
			id: string;
			name: string;
			phone: string | null;
			orders: number;
			revenue: string;
			lastOrderAt: string;
		}[];

		const toRow = (r: (typeof top)[number]) => ({
			...r,
			revenue: Number(r.revenue),
			lastOrderAt: new Date(r.lastOrderAt).toISOString(),
		});
		const customers = Number(summary.customers);
		const newCustomers = Number(summary.newCustomers);
		return {
			orders: Number(summary.orders),
			revenue: Number(summary.revenue),
			identifiedOrders: Number(summary.identifiedOrders),
			identifiedRevenue: Number(summary.identifiedRevenue),
			customers,
			newCustomers,
			returningCustomers: customers - newCustomers,
			top: top.map(toRow),
			lapsed: lapsed.map(toRow),
		};
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
