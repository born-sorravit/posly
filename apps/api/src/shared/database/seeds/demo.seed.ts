import { User } from "@/models/users/entities/user.entity";
import {
	DAYS,
	createAccounts,
	createShop,
	removeDemo,
} from "@/shared/database/seeds/demo-builder";
import {
	DEMO_ACCOUNTS,
	DEMO_EMAIL_DOMAIN,
	DEMO_PASSWORD,
	DEMO_SHOPS,
} from "@/shared/database/seeds/demo.data";
import { dataSourceOptions } from "@/shared/database/typeorm.config";
import { DEMO_PIN } from "@/shared/utils/demo.util";
import { Logger } from "@nestjs/common";
import { DataSource, Like } from "typeorm";

/**
 * Demo shops with 30 days of sales history.
 *
 *   pnpm seed:demo            create them (refuses if they already exist)
 *   pnpm seed:demo -- --reset remove everything it created, then create it again
 *   pnpm seed:demo -- --remove remove everything it created
 */

const logger = new Logger("DemoSeed");

const run = async (): Promise<void> => {
	const args = new Set(process.argv.slice(2));
	const dataSource = new DataSource(dataSourceOptions);
	await dataSource.initialize();

	try {
		if (args.has("--reset") || args.has("--remove"))
			await dataSource.transaction((m) => removeDemo(m));
		if (args.has("--remove")) return;

		const existing = await dataSource
			.getRepository(User)
			.count({ where: { email: Like(`%@${DEMO_EMAIL_DOMAIN}`) } });
		if (existing > 0) {
			logger.warn("Demo data already exists. Run with --reset to recreate it.");
			return;
		}

		const users = await dataSource.transaction((m) => createAccounts(m));
		for (const [i, shop] of DEMO_SHOPS.entries()) {
			const { orders, customers, expenses } = await dataSource.transaction((m) =>
				createShop(m, shop, users, 1000 + i)
			);
			logger.log(
				`${shop.name} (${shop.businessType}): ${orders} orders over ${DAYS} days, ${customers} customers, ${expenses} expenses`
			);
		}

		logger.log(
			`Password for every demo account: ${DEMO_PASSWORD} · PIN: ${DEMO_PIN}`
		);
		for (const account of DEMO_ACCOUNTS) {
			const shops = DEMO_SHOPS.filter((s) =>
				s.members.some((m) => m.account === account.key)
			)
				.map(
					(s) =>
						`${s.name} (${s.members.find((m) => m.account === account.key)?.role})`
				)
				.join(", ");
			logger.log(`  ${account.email.padEnd(24)} ${shops}`);
		}
	} finally {
		await dataSource.destroy();
	}
};

run().catch((error) => {
	new Logger("DemoSeed").error(
		error instanceof Error ? (error.stack ?? error.message) : String(error)
	);
	process.exit(1);
});
