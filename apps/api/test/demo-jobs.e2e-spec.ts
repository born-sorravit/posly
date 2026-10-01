import { DemoJobsService } from "@/modules/demo/demo-jobs.service";
import { recreateDemo } from "@/shared/database/seeds/demo-builder";
import {
	bangkokMidnight,
	dayTarget,
	shareBy,
} from "@/shared/database/seeds/demo-day";
import { DEMO_SHOPS } from "@/shared/database/seeds/demo.data";
import { getLocalDateString } from "@/shared/utils/date.util";
import type { INestApplication } from "@nestjs/common";
import { DataSource } from "typeorm";
import { bootApp } from "./helpers";

jest.setTimeout(120_000);

describe("demo upkeep", () => {
	let app: INestApplication;
	let dataSource: DataSource;
	const cafe = DEMO_SHOPS[0];

	const cafeId = async () =>
		(
			(await dataSource.query(
				`SELECT b.id FROM business b JOIN business_member m ON m.business_id = b.id AND m.role = 'OWNER'
				 JOIN "user" u ON u.id = m.user_id WHERE b.name = $1 AND u.email LIKE '%@demo.posly'`,
				[cafe.name]
			)) as { id: string }[]
		)[0]?.id;
	const ordersToday = async (businessId: string) =>
		(
			(await dataSource.query(
				`SELECT COUNT(*)::int AS n FROM "order" WHERE business_id = $1 AND created_at >= $2`,
				[businessId, bangkokMidnight(getLocalDateString())]
			)) as { n: number }[]
		)[0].n;

	beforeAll(async () => {
		app = await bootApp();
		dataSource = app.get(DataSource);
	});

	afterAll(async () => {
		await app.close();
	});

	it("rebuilds the demo in one go, twice in a row", async () => {
		await dataSource.transaction((m) => recreateDemo(m));
		const first = await cafeId();
		await dataSource.transaction((m) => recreateDemo(m));
		const second = await cafeId();
		expect(second).toBeDefined();
		expect(second).not.toBe(first);
		const tables = await dataSource.query(
			`SELECT COUNT(*)::int AS n FROM dining_table WHERE business_id = $1`,
			[second]
		);
		expect(tables[0].n).toBe(8);
	});

	it("tops today up to the day's pace, once", async () => {
		const id = (await cafeId()) as string;
		const now = new Date();
		const date = getLocalDateString(now);
		const target = Math.round(dayTarget(cafe, date) * shareBy(cafe, date, now));

		await app.get(DemoJobsService).topUp(now);
		expect(await ordersToday(id)).toBeGreaterThanOrEqual(Math.min(target, 150));

		const before = await ordersToday(id);
		const again = await app.get(DemoJobsService).topUp(now);
		expect(again[cafe.name] ?? 0).toBe(0);
		expect(await ordersToday(id)).toBe(before);

		// Numbers stay one sequence with the shop's counter.
		const [{ max, seq }] = await dataSource.query(
			`SELECT MAX(o.number)::int AS max, b.order_seq AS seq FROM "order" o JOIN business b ON b.id = o.business_id
			 WHERE b.id = $1 GROUP BY b.order_seq`,
			[id]
		);
		expect(max).toBe(seq);
	});

	it("serves walk-in tickets nobody closed", async () => {
		const id = (await cafeId()) as string;
		await dataSource.query(
			`UPDATE "order" SET kitchen_status = 'NEW' WHERE id = (
			   SELECT id FROM "order" WHERE business_id = $1 AND status = 'PAID' ORDER BY created_at LIMIT 1)`,
			[id]
		);
		await app.get(DemoJobsService).topUp(new Date());
		const [{ n }] = await dataSource.query(
			`SELECT COUNT(*)::int AS n FROM "order" WHERE business_id = $1 AND status = 'PAID'
			   AND kitchen_status <> 'SERVED' AND created_at < now() - interval '30 minutes'`,
			[id]
		);
		expect(n).toBe(0);
	});
});
