import configuration, { loadEnv } from "@/config/configuration";
import { DataSource, DataSourceOptions } from "typeorm";

loadEnv();

const config = configuration().database;

const toInt = (value: string | undefined, fallback: number): number => {
	const parsed = Number.parseInt(value ?? "", 10);
	return Number.isNaN(parsed) ? fallback : parsed;
};

/**
 * Shared by the runtime (`DatabaseModule`), the TypeORM CLI and the e2e tests.
 *
 * The glob follows whichever copy of the code is executing: loading entities from `dist/`
 * while the caller imported the TypeScript class registers two classes for one table, and
 * TypeORM then reports "No metadata for X was found" under ts-jest.
 */
const runningFromSource = __filename.endsWith(".ts");
const root = runningFromSource ? "src" : "dist";
const ext = runningFromSource ? "ts" : "js";

export const dataSourceOptions: DataSourceOptions = {
	type: "postgres",
	url: config.url,
	synchronize: config.synchronize,
	logging: config.logging,
	ssl: config.ssl,
	entities: [`${root}/models/**/*.entity.${ext}`],
	migrations: [`${root}/shared/database/migrations/*.${ext}`],
	/**
	 * Supabase's session pooler allows 15 clients in total, shared with every BullMQ queue and
	 * worker once those exist. node-postgres defaults to 10 — most of the budget on its own.
	 */
	extra: { max: toInt(process.env.DB_POOL_MAX, 3) },
};

export const dataSource = new DataSource(dataSourceOptions);
