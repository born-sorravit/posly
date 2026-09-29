import configuration, { loadEnv } from "@/config/configuration";
import * as path from "node:path";
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
 *
 * Resolved from this file, not the working directory: Railway runs the start and pre-deploy
 * commands from the repo root, where a relative `dist/` glob matches nothing — no entities
 * and, worse, no migrations, with no error.
 */
const runningFromSource = __filename.endsWith(".ts");
const root = path.resolve(__dirname, "..", "..");
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
	 * A direct Railway Postgres connection, no pooler in front: node-postgres' own default of
	 * 10 fits well inside the server's connection limit. Realtime holds one more for LISTEN.
	 */
	extra: { max: toInt(process.env.DB_POOL_MAX, 10) },
};

export const dataSource = new DataSource(dataSourceOptions);
