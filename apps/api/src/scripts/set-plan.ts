/**
 * Moves a shop to a plan until billing exists (plan §45 "Subscription Payment").
 *
 *   pnpm subscription:set -- <business id or exact name> <FREE|STARTER|PRO|BUSINESS> [days]
 *
 * With `days` the plan ends that many days from now and the shop falls back to Free after;
 * without it the plan is open-ended. There is deliberately no API for this: a self-serve
 * "switch plan" endpoint without payment would give every plan away.
 */
import { dataSource } from "@/shared/database/typeorm.config";
import { Logger } from "@nestjs/common";

const logger = new Logger("subscription:set");

const [target, plan, days] = process.argv.slice(2);

async function main() {
	if (!target || !plan) {
		logger.error(
			"Usage: pnpm subscription:set -- <business id|name> <FREE|STARTER|PRO|BUSINESS> [days]"
		);
		process.exit(1);
	}
	await dataSource.initialize();
	try {
		const code = plan.toUpperCase();
		const [known] = await dataSource.query(
			`SELECT code FROM subscription_plan WHERE code = $1`,
			[code]
		);
		if (!known) throw new Error(`Unknown plan ${code}`);

		const byId = /^[0-9a-f-]{36}$/i.test(target);
		const businesses = (await dataSource.query(
			`SELECT id, name FROM business WHERE deleted_at IS NULL AND ${byId ? "id = $1" : "name = $1"}`,
			[target]
		)) as { id: string; name: string }[];
		if (businesses.length !== 1) {
			throw new Error(
				businesses.length
					? `"${target}" matches ${businesses.length} shops; use the id`
					: `No shop "${target}"`
			);
		}
		const [business] = businesses;
		const endDate = days ? new Date(Date.now() + Number(days) * 86_400_000) : null;

		await dataSource.query(
			`INSERT INTO subscription (business_id, plan_code, status, start_date, end_date)
			 VALUES ($1, $2, 'ACTIVE', now(), $3)
			 ON CONFLICT (business_id) WHERE deleted_at IS NULL
			 DO UPDATE SET plan_code = EXCLUDED.plan_code, status = 'ACTIVE', start_date = now(),
			               end_date = EXCLUDED.end_date, cancel_at_period_end = false, updated_at = now()`,
			[business.id, code, endDate]
		);
		logger.log(
			`${business.name} → ${code}${endDate ? ` until ${endDate.toISOString()}` : " (open-ended)"}`
		);
	} finally {
		await dataSource.destroy();
	}
}

main().catch((error) => {
	logger.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
