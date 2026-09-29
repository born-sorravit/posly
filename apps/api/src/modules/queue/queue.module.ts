import configuration from "@/config/configuration";
import { DEFAULT_JOB_OPTIONS } from "@/constants/queue.constants";
import { BullModule } from "@nestjs/bullmq";
import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * BullMQ on Railway Redis, the same instance the cache uses.
 *
 * **No queues are registered yet**, so nothing connects to Redis today and CI needs none. A
 * queue is added here only together with the producer and processor that use it (daily
 * summary, LINE notifications, low-stock alerts). Register them with
 * `BullModule.registerQueue` in the feature module.
 */
@Global()
@Module({
	imports: [
		BullModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService) => {
				const redis =
					config.getOrThrow<ReturnType<typeof configuration>["redis"]>("redis");
				const queue =
					config.getOrThrow<ReturnType<typeof configuration>["queue"]>("queue");

				return {
					connection: {
						url: redis.url || undefined,
						// Railway's private network resolves over IPv6 as well as IPv4.
						family: 0,
						// Workers block on Redis; BullMQ requires retries to be unbounded.
						maxRetriesPerRequest: null,
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
