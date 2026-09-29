import * as fs from "node:fs";
import * as dotenv from "dotenv";

/**
 * Picks the env file from NODE_ENV, mirroring the deployment layout:
 *   development -> .env.development.local
 *   anything else (local, staging, production) -> .env / real process env
 * On Render/Vercel the platform injects the variables directly, so no file exists.
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
 * Cache only, over Upstash's REST API — optional, falls back to an in-process Map.
 * BullMQ does not run on this; see `QueueConfig`.
 */
export interface CacheConfig {
	provider: "upstash" | "memory";
	restUrl: string | undefined;
	restToken: string | undefined;
	prefix: string;
	ttlSeconds: number;
}

export interface QueueConfig {
	/**
	 * BullMQ's PostgreSQL backend: reuses the Supabase database over LISTEN/NOTIFY, so there
	 * is no broker to pay for. Requires a **session**-mode connection (Supabase port 5432).
	 */
	backend: "postgres";
	schema: string;
	prefix: string;
}

/**
 * Supabase Storage, for product images and store logos.
 *
 * The API never streams file bytes. It mints a short-lived signed upload URL scoped to one
 * object path under the caller's business, the browser PUTs the file straight to Supabase,
 * and the API stores only the resulting path. That keeps 5 MB photos off a 512 MB instance
 * and keeps the service-role key on the server.
 */
export interface StorageConfig {
	/** Project URL, e.g. https://<ref>.supabase.co. Empty disables uploads. */
	supabaseUrl: string;
	/** Service-role key. Server-only: it bypasses row-level security. */
	serviceRoleKey: string;
	/** A **public** bucket — product photos are shown on receipts and to anyone at the till. */
	bucket: string;
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

export interface Configuration {
	app: AppConfig;
	database: DatabaseConfig;
	cache: CacheConfig;
	queue: QueueConfig;
	security: SecurityConfig;
	storage: StorageConfig;
	mail: MailConfig;
	billing: BillingConfig;
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
		// Supabase terminates TLS with a chain Node does not ship, so verification is opt-in.
		ssl: toBool(process.env.DB_SSL, true)
			? { rejectUnauthorized: false }
			: undefined,
	},
	cache: {
		provider:
			process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
				? "upstash"
				: "memory",
		restUrl: process.env.UPSTASH_REDIS_REST_URL,
		restToken: process.env.UPSTASH_REDIS_REST_TOKEN,
		prefix: process.env.CACHE_PREFIX ?? "posly",
		ttlSeconds: toInt(process.env.CACHE_TTL_SECONDS, 300),
	},
	queue: {
		backend: "postgres",
		schema: process.env.QUEUE_SCHEMA ?? "bullmq",
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
	},
	storage: {
		supabaseUrl: (process.env.SUPABASE_URL ?? "").replace(/\/+$/, ""),
		serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
		bucket: process.env.SUPABASE_STORAGE_BUCKET ?? "posly",
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
});
