import * as fs from "node:fs";
import * as dotenv from "dotenv";

/**
 * Picks the env file from NODE_ENV, mirroring the deployment layout:
 *   development -> .env.development.local
 *   anything else (local, staging, production) -> .env / real process env
 * On Railway/Vercel the platform injects the variables directly, so no file exists.
 */
export const getEnvFilePath = (): string | undefined =>
	process.env.NODE_ENV === "development" ? ".env.development.local" : ".env";

export const loadEnv = (): void => {
	const envPath = getEnvFilePath();
	if (!envPath) return;

	if (fs.existsSync(envPath)) {
		dotenv.config({ path: envPath });
		return;
	}

	/**
	 * The file this NODE_ENV selects is missing. Normal on a platform that injects variables;
	 * locally it means every variable is about to be empty, and the first symptom would be
	 * something far away like "JwtStrategy requires a secret or key".
	 */
	if (process.env.NODE_ENV !== "production" && !process.env.JWT_SECRET) {
		// biome-ignore lint/suspicious/noConsole: runs before Nest boots, so there is no Logger yet
		console.warn(
			`[config] ${envPath} not found and no variables are set in the environment.\n` +
				`         NODE_ENV=${process.env.NODE_ENV ?? "(unset)"} selects that file; ` +
				`"pnpm start:local" reads .env instead.`
		);
	}
};

/**
 * Refuses to start on a configuration that cannot work. `getOrThrow` does not help: the keys
 * exist, they are just empty strings.
 */
export const assertUsableConfiguration = (config: Configuration): void => {
	const missing: string[] = [];

	if (!config.database.url) missing.push("DATABASE_URL");
	if (!config.security.jwt.secret) missing.push("JWT_SECRET");

	if (missing.length === 0) return;

	throw new Error(
		`Missing required configuration: ${missing.join(", ")}.\n` +
			`Expected them in ${getEnvFilePath() ?? "the environment"} ` +
			`(NODE_ENV=${process.env.NODE_ENV ?? "(unset)"}). See .env.example.`
	);
};

const toInt = (value: string | undefined, fallback: number): number => {
	const parsed = Number.parseInt(value ?? "", 10);
	return Number.isNaN(parsed) ? fallback : parsed;
};

const toBool = (value: string | undefined, fallback: boolean): boolean => {
	if (value === undefined || value === "") return fallback;
	return value === "true" || value === "1";
};

export interface AppConfig {
	env: string;
	port: number;
	apiPrefix: string;
	corsOrigins: string[];
	/** Default for a new business; each business stores its own afterwards. */
	timezone: string;
	publicWebUrl: string;
}

export interface DatabaseConfig {
	url: string;
	synchronize: boolean;
	logging: boolean;
	ssl: { rejectUnauthorized: boolean } | undefined;
}

/**
 * Railway Redis, shared by the cache and BullMQ. Empty `REDIS_URL` leaves the cache on an
 * in-process Map; queues need it only once one is registered.
 */
export interface RedisConfig {
	url: string;
}

/** Read-through cache — optional, falls back to an in-process Map without Redis. */
export interface CacheConfig {
	provider: "redis" | "memory";
	prefix: string;
	ttlSeconds: number;
}

export interface QueueConfig {
	prefix: string;
}

/**
 * An S3-compatible bucket (Railway Storage Buckets), for product images and store logos.
 *
 * The API never streams file bytes. It mints a short-lived presigned PUT URL scoped to one
 * object path under the caller's business, the browser uploads straight to the bucket, and
 * the API stores only the resulting path. Railway buckets are private, so images are read
 * through `GET /media/<path>`, which redirects to a short-lived presigned GET.
 */
export interface StorageConfig {
	/** e.g. https://t3.storageapi.dev. Empty disables uploads. */
	endpoint: string;
	region: string;
	bucket: string;
	accessKeyId: string;
	secretAccessKey: string;
	/** Older Railway buckets need path-style URLs; new ones are virtual-hosted. */
	forcePathStyle: boolean;
	/** Public origin of this API (https://api.example.com), for the stable image URLs. */
	publicBaseUrl: string;
	maxUploadBytes: number;
}

export interface SecurityConfig {
	jwt: {
		secret: string;
		/** Access-token lifetime, as a jsonwebtoken duration string (e.g. "15m"). */
		expiresIn: string;
	};
	/**
	 * Refresh tokens are opaque random strings; only their SHA-256 hash is stored. A number
	 * of days — deliberately not fed to `expiresIn`, which reads a bare number as seconds.
	 */
	refreshTtlDays: number;
	bcryptRounds: number;
	throttle: { ttlSeconds: number; limit: number };
	/**
	 * The admin monitor accepts only sessions signed in with Google. On by default in
	 * production; ADMIN_REQUIRE_GOOGLE=true/false overrides it anywhere.
	 */
	adminRequireGoogle: boolean;
	/** OAuth client id Google ID tokens must be minted for. Empty disables Google sign-in. */
	googleClientId: string;
}

/**
 * Outgoing email. With a Resend key, mail is sent through Resend's HTTP API; without one it
 * is written to the log instead, which is enough to follow a reset link in development.
 */
export interface MailConfig {
	resendApiKey: string;
	/** "Posly <no-reply@your-domain>" — a domain verified in Resend. */
	from: string;
}

/**
 * Stripe, for paid plans. Without a secret key online payment is off: the plans page says
 * to contact the team, and plans are still set by `pnpm subscription:set`.
 */
export interface BillingConfig {
	stripeSecretKey: string;
	/** `whsec_…` from the webhook endpoint (or `stripe listen` locally). */
	stripeWebhookSecret: string;
}

/**
 * The public "try it" login on the landing page. Off by default, so an environment without
 * the demo seed never offers a button that cannot work.
 */
export interface DemoConfig {
	enabled: boolean;
	/**
	 * Keeps the shared demo shops looking alive: rebuilt every night at 04:00 Bangkok time and
	 * topped up with sales through the day. Off by default — it deletes and recreates every
	 * demo account, so only the environment that hosts the public demo should turn it on.
	 */
	autoReset: boolean;
}

export interface Configuration {
	app: AppConfig;
	database: DatabaseConfig;
	redis: RedisConfig;
	cache: CacheConfig;
	queue: QueueConfig;
	security: SecurityConfig;
	storage: StorageConfig;
	mail: MailConfig;
	billing: BillingConfig;
	demo: DemoConfig;
}

export default (): Configuration => ({
	app: {
		env: process.env.NODE_ENV ?? "local",
		port: toInt(process.env.PORT, 3001),
		apiPrefix: process.env.API_PREFIX ?? "api",
		corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:3000")
			.split(",")
			.map((origin) => origin.trim())
			.filter(Boolean),
		timezone: process.env.APP_TIMEZONE ?? "Asia/Bangkok",
		publicWebUrl: process.env.PUBLIC_WEB_URL ?? "http://localhost:3000",
	},
	database: {
		url: process.env.DATABASE_URL ?? "",
		synchronize: false,
		logging: toBool(process.env.DB_LOGGING, false),
		// Railway's private network is plain TCP (DB_SSL=false); its public TCP proxy presents a
		// self-signed certificate, so verification is opt-in.
		ssl: toBool(process.env.DB_SSL, true)
			? { rejectUnauthorized: false }
			: undefined,
	},
	redis: {
		url: process.env.REDIS_URL ?? "",
	},
	cache: {
		provider: process.env.REDIS_URL ? "redis" : "memory",
		prefix: process.env.CACHE_PREFIX ?? "posly",
		ttlSeconds: toInt(process.env.CACHE_TTL_SECONDS, 300),
	},
	queue: {
		prefix: process.env.QUEUE_PREFIX ?? "posly",
	},
	security: {
		jwt: {
			secret: process.env.JWT_SECRET ?? "",
			expiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
		},
		refreshTtlDays: toInt(process.env.REFRESH_TTL_DAYS, 30),
		bcryptRounds: toInt(process.env.BCRYPT_ROUNDS, 10),
		throttle: {
			ttlSeconds: toInt(process.env.THROTTLE_TTL_SECONDS, 60),
			limit: toInt(process.env.THROTTLE_LIMIT, 120),
		},
		googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
		adminRequireGoogle: toBool(
			process.env.ADMIN_REQUIRE_GOOGLE,
			process.env.NODE_ENV === "production"
		),
	},
	storage: {
		endpoint: (process.env.S3_ENDPOINT ?? "").replace(/\/+$/, ""),
		region: process.env.S3_REGION || "auto",
		bucket: process.env.S3_BUCKET ?? "",
		accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
		secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
		forcePathStyle: toBool(process.env.S3_FORCE_PATH_STYLE, false),
		publicBaseUrl: (
			process.env.PUBLIC_API_URL ?? `http://localhost:${process.env.PORT ?? 3001}`
		).replace(/\/+$/, ""),
		maxUploadBytes: toInt(process.env.STORAGE_MAX_UPLOAD_BYTES, 5 * 1024 * 1024),
	},
	mail: {
		resendApiKey: process.env.RESEND_API_KEY ?? "",
		from: process.env.MAIL_FROM ?? "Posly <onboarding@resend.dev>",
	},
	billing: {
		stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
		stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
	},
	demo: {
		enabled: toBool(process.env.DEMO_ENABLED, false),
		autoReset: toBool(process.env.DEMO_AUTO_RESET, false),
	},
});
