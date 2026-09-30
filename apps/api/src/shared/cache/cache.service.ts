import type { CacheConfig, RedisConfig } from "@/config/configuration";
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Redis } from "ioredis";

export interface CacheStats {
	provider: "redis" | "memory";
	/** Keys under this app's prefix, counted by their first segment (`dashboard`, `v`…). */
	keys: { total: number; byKind: Record<string, number>; truncated: boolean };
	/** Redis only: the server's own figures, which cover every client of that Redis. */
	server: {
		version: string | null;
		usedMemoryMb: number | null;
		maxMemoryMb: number | null;
		hits: number | null;
		misses: number | null;
		evictedKeys: number | null;
		uptimeSeconds: number | null;
	} | null;
}

/** SCAN stops counting here: the admin page wants a picture, not an audit of a huge keyspace. */
const STATS_SCAN_LIMIT = 10_000;

interface MemoryEntry {
	value: unknown;
	expiresAt: number;
}

/**
 * A small read-through cache.
 *
 * Railway Redis over its private network, shared with BullMQ. Values are stored as JSON.
 *
 * With no REDIS_URL it degrades to an in-process Map, so local development and CI need no
 * network service and nothing has to branch on whether a cache exists.
 */
@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(CacheService.name);
	private readonly config: CacheConfig;
	private readonly redisConfig: RedisConfig;
	private readonly memory = new Map<string, MemoryEntry>();
	private readonly versions = new Map<string, number>();
	private redis: Redis | null = null;

	constructor(configService: ConfigService) {
		this.config = configService.getOrThrow<CacheConfig>("cache");
		this.redisConfig = configService.getOrThrow<RedisConfig>("redis");
	}

	onModuleInit(): void {
		if (this.config.provider === "redis" && this.redisConfig.url) {
			this.redis = new Redis(this.redisConfig.url, {
				// Railway's private network resolves over IPv6 as well as IPv4.
				family: 0,
				lazyConnect: true,
				// Fail a command fast rather than hold a request while Redis is away.
				maxRetriesPerRequest: 1,
			});
			this.redis.on("error", (error: Error) => {
				this.logger.warn(`Redis: ${error.message}`);
			});
			this.logger.log("Cache: Redis");
			return;
		}
		this.logger.log("Cache: in-process (no REDIS_URL configured)");
	}

	async onModuleDestroy(): Promise<void> {
		await this.redis?.quit().catch(() => undefined);
	}

	/**
	 * Returns the cached value, or computes and stores it.
	 *
	 * A cache failure is never allowed to fail the request — the point of a cache is to be
	 * optional. A miss and an outage look the same to the caller.
	 */
	async remember<T>(
		key: string,
		factory: () => Promise<T>,
		ttlSeconds?: number
	): Promise<T> {
		const ttl = ttlSeconds ?? this.config.ttlSeconds;
		const namespaced = `${this.config.prefix}:${key}`;

		const cached = await this.read<T>(namespaced);
		if (cached !== undefined) return cached;

		const value = await factory();
		await this.write(namespaced, value, ttl);
		return value;
	}

	/**
	 * A counter that is part of a family of cache keys, so one `bump` retires every key built
	 * on the old value — e.g. a shop's dashboard across all its ranges and branch scopes —
	 * without having to know or list them. Read it, put it in the key, and the stale entries
	 * simply stop being asked for and expire on their own TTL.
	 */
	async version(key: string): Promise<number> {
		const namespaced = `${this.config.prefix}:v:${key}`;
		if (this.redis) {
			try {
				return Number(await this.redis.get(namespaced)) || 0;
			} catch {
				return 0;
			}
		}
		return this.versions.get(namespaced) ?? 0;
	}

	/** Moves `version(key)` on. Like every write here, a failure never fails the caller. */
	async bump(key: string): Promise<void> {
		const namespaced = `${this.config.prefix}:v:${key}`;
		if (this.redis) {
			await this.redis
				.multi()
				.incr(namespaced)
				// Outlives any key built on it; a counter nobody bumps for a day can go.
				.expire(namespaced, 86_400)
				.exec()
				.catch((error: Error) => {
					this.logger.warn(`Cache bump failed for ${key}: ${error.message}`);
				});
			return;
		}
		this.versions.set(namespaced, (this.versions.get(namespaced) ?? 0) + 1);
	}

	/** For the admin system page: which backend is in use and whether it answers. */
	async ping(): Promise<{
		provider: "redis" | "memory";
		up: boolean;
		latencyMs: number | null;
	}> {
		if (!this.redis) return { provider: "memory", up: true, latencyMs: null };
		const started = performance.now();
		try {
			await this.redis.ping();
			return {
				provider: "redis",
				up: true,
				latencyMs: Math.round(performance.now() - started),
			};
		} catch {
			return { provider: "redis", up: false, latencyMs: null };
		}
	}

	/** For the admin system page: what is cached, and how the Redis server is doing. */
	async stats(): Promise<CacheStats> {
		const byKind: Record<string, number> = {};
		const count = (namespaced: string) => {
			const kind =
				namespaced.slice(this.config.prefix.length + 1).split(":")[0] || "?";
			byKind[kind] = (byKind[kind] ?? 0) + 1;
		};

		if (!this.redis) {
			for (const key of this.memory.keys()) count(key);
			for (const key of this.versions.keys()) count(key);
			const total = this.memory.size + this.versions.size;
			return {
				provider: "memory",
				keys: { total, byKind, truncated: false },
				server: null,
			};
		}

		let total = 0;
		let truncated = false;
		let cursor = "0";
		do {
			const [next, batch] = await this.redis.scan(
				cursor,
				"MATCH",
				`${this.config.prefix}:*`,
				"COUNT",
				500
			);
			cursor = next;
			for (const key of batch) count(key);
			total += batch.length;
			if (total >= STATS_SCAN_LIMIT) {
				truncated = cursor !== "0";
				break;
			}
		} while (cursor !== "0");

		const info = await this.redis.info();
		const field = (name: string): string | null =>
			new RegExp(`^${name}:(.*)$`, "m").exec(info)?.[1]?.trim() ?? null;
		const number = (name: string): number | null => {
			const value = field(name);
			return value === null ? null : Number(value);
		};
		const mb = (bytes: number | null) =>
			bytes === null ? null : Math.round((bytes / 1024 / 1024) * 10) / 10;
		const maxMemory = number("maxmemory");

		return {
			provider: "redis",
			keys: { total, byKind, truncated },
			server: {
				version: field("redis_version"),
				usedMemoryMb: mb(number("used_memory")),
				// 0 means "no limit" in Redis.
				maxMemoryMb: maxMemory ? mb(maxMemory) : null,
				hits: number("keyspace_hits"),
				misses: number("keyspace_misses"),
				evictedKeys: number("evicted_keys"),
				uptimeSeconds: number("uptime_in_seconds"),
			},
		};
	}

	async forget(key: string): Promise<void> {
		const namespaced = `${this.config.prefix}:${key}`;
		this.memory.delete(namespaced);

		if (this.redis) {
			await this.redis.del(namespaced).catch((error: Error) => {
				this.logger.warn(`Cache delete failed for ${key}: ${error.message}`);
			});
		}
	}

	private async read<T>(key: string): Promise<T | undefined> {
		if (this.redis) {
			try {
				const value = await this.redis.get(key);
				return value === null ? undefined : (JSON.parse(value) as T);
			} catch (error) {
				this.logger.warn(
					`Cache read failed for ${key}: ${error instanceof Error ? error.message : error}`
				);
				return undefined;
			}
		}

		const entry = this.memory.get(key);
		if (!entry) return undefined;
		if (entry.expiresAt <= Date.now()) {
			this.memory.delete(key);
			return undefined;
		}
		return entry.value as T;
	}

	private async write(
		key: string,
		value: unknown,
		ttlSeconds: number
	): Promise<void> {
		if (this.redis) {
			await this.redis
				.set(key, JSON.stringify(value), "EX", ttlSeconds)
				.catch((error: Error) => {
					this.logger.warn(`Cache write failed for ${key}: ${error.message}`);
				});
			return;
		}

		this.memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
	}
}
