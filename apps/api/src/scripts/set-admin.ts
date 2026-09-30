/**
 * Grants or revokes access to the platform admin monitor (apps/admin).
 *
 *   pnpm admin:set -- <email> [off]
 *
 * There is deliberately no API for this: whoever could call it would already be an admin,
 * and the first admin has to come from somewhere outside the app.
 */
import { dataSource } from "@/shared/database/typeorm.config";
import { Logger } from "@nestjs/common";

const logger = new Logger("admin:set");

// `pnpm admin:set -- x` hands the script a literal "--" as well; drop it.
const [email, flag] = process.argv.slice(2).filter((arg) => arg !== "--");

async function main() {
	if (!email || (flag && flag !== "off")) {
		logger.error("Usage: pnpm admin:set -- <email> [off]");
		process.exit(1);
	}
	await dataSource.initialize();
	try {
		const enable = flag !== "off";
		const [rows] = (await dataSource.query(
			`UPDATE "user" SET is_platform_admin = $2, updated_at = now()
			 WHERE lower(email) = lower($1) AND deleted_at IS NULL
			 RETURNING email`,
			[email, enable]
		)) as [{ email: string }[], number];
		if (!rows.length) throw new Error(`No account "${email}"`);
		logger.log(`${rows[0].email} → ${enable ? "platform admin" : "not an admin"}`);
	} finally {
		await dataSource.destroy();
	}
}

main().catch((error) => {
	logger.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
