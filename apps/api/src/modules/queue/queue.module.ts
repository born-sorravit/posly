import configuration from "@/config/configuration";
import { DEFAULT_JOB_OPTIONS } from "@/constants/queue.constants";
import { BullModule } from "@nestjs/bullmq";
import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createPostgresBackend, setDefaultBackendFactory } from "bullmq";

/**
 * BullMQ on the PostgreSQL backend — the same Supabase database, over LISTEN/NOTIFY.
 *
 * Installed at module scope so anything that boots `AppModule` (including e2e suites that
 * never run `main.ts`) gets it; without it BullMQ silently falls back to Redis on :6379.
 *
 * **No queues are registered yet.** Every Queue and Worker holds its own connection against
 * Supabase's 15-client session-pooler budget, so a queue is added here only together with
 * the producer and processor that use it (daily summary, LINE notifications, low-stock
 * alerts). Register them with `BullModule.registerQueue` in the feature module.
 */
setDefaultBackendFactory(createPostgresBackend);

@Global()
@Module({
	imports: [
		BullModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService) => {
				const database =
					config.getOrThrow<ReturnType<typeof configuration>["database"]>(
						"database"
					);
				const queue =
					config.getOrThrow<ReturnType<typeof configuration>["queue"]>("queue");

				return {
					connection: {
						connectionString: database.url,
						ssl: database.ssl,
						schema: queue.schema,
						// BullMQ owns and migrates its own tables, in their own schema, so
						// TypeORM's migration diff never sees them.
						migrate: true,
						// One pooled connection per queue/worker: the work is queued, not
						// latency-sensitive, and the pooler budget is shared with the API.
						max: 1,
					},
					prefix: queue.prefix,
					defaultJobOptions: DEFAULT_JOB_OPTIONS,
				};
			},
		}),
	],
	exports: [BullModule],
})
export class QueueModule {}
