import type { ResolvedMembership } from "@/shared/decorators/current-membership.decorator";
import {
	Injectable,
	Logger,
	type OnModuleDestroy,
	type OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Client } from "pg";
import { Subject } from "rxjs";
import type { EntityManager } from "typeorm";
import { DataSource } from "typeorm";

/** What changed. A signal only — clients re-read through the normal, permission-checked API. */
export type RealtimeTopic = "kitchen" | "orders" | "notifications";

export interface RealtimeEvent {
	topic: RealtimeTopic;
	businessId: string;
	/** Null: the whole shop. Otherwise only members who can see this branch hear it. */
	branchId: string | null;
}

const CHANNEL = "posly_events";
const TICKET_TTL_SECONDS = 60;

/**
 * Live updates (plan §27): the kitchen screen, the bell and the dashboard hear about a
 * change within a second instead of polling for it.
 *
 * Events travel through Postgres LISTEN/NOTIFY, so every API instance hears every event
 * with no broker to run — and `pg_notify` inside a transaction is delivered only when it
 * commits, so a rolled-back sale never makes a screen refresh. Each instance holds one
 * dedicated connection for LISTEN (Supabase's session pooler, port 5432, supports it).
 *
 * If that connection is down, events still reach this instance's own streams directly, and
 * clients keep a slow poll as a safety net; nothing depends on an event arriving.
 */
@Injectable()
export class RealtimeService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(RealtimeService.name);
	readonly events = new Subject<RealtimeEvent>();
	private listener: Client | null = null;
	private listening = false;
	private stopped = false;
	private retry: NodeJS.Timeout | null = null;

	constructor(
		private readonly dataSource: DataSource,
		private readonly config: ConfigService
	) {}

	onModuleInit(): void {
		void this.listen();
	}

	async onModuleDestroy(): Promise<void> {
		this.stopped = true;
		if (this.retry) clearTimeout(this.retry);
		this.events.complete();
		await this.listener?.end().catch(() => undefined);
	}

	private async listen(): Promise<void> {
		const database = this.config.get<{ url: string; ssl?: object }>("database");
		if (!database?.url || this.stopped) return;
		const client = new Client({ connectionString: database.url, ssl: database.ssl });
		client.on("notification", (message) => {
			if (message.channel !== CHANNEL || !message.payload) return;
			try {
				this.events.next(JSON.parse(message.payload) as RealtimeEvent);
			} catch {
				// Not ours; ignore.
			}
		});
		const reconnect = (why: unknown) => {
			if (this.stopped) return;
			this.listening = false;
			this.logger.warn(`LISTEN connection lost (${String(why)}); retrying in 5s`);
			client.removeAllListeners();
			void client.end().catch(() => undefined);
			this.retry = setTimeout(() => void this.listen(), 5000);
		};
		client.on("error", reconnect);
		client.on("end", () => this.listening && reconnect("ended"));
		try {
			await client.connect();
			await client.query(`LISTEN ${CHANNEL}`);
			this.listener = client;
			this.listening = true;
		} catch (error) {
			reconnect(error instanceof Error ? error.message : error);
		}
	}

	/**
	 * Announces a change. Pass the transaction's manager so the event goes out only if the
	 * change commits; without the LISTEN connection it is delivered to this instance alone.
	 */
	async publish(manager: EntityManager | null, event: RealtimeEvent): Promise<void> {
		// Without our own LISTEN, NOTIFY would reach other instances but not this one.
		if (!this.listening) this.events.next(event);
		await (manager ?? this.dataSource.manager).query("SELECT pg_notify($1, $2)", [
			CHANNEL,
			JSON.stringify(event),
		]);
	}

	/** Whether this member may hear this event: same shop, and a branch they can see. */
	static visibleTo(event: RealtimeEvent, membership: ResolvedMembership): boolean {
		if (event.businessId !== membership.businessId) return false;
		if (event.branchId === null || membership.branchIds === null) return true;
		return membership.branchIds.includes(event.branchId);
	}

	// ------------------------------------------------------------------ stream tickets

	/**
	 * `EventSource` cannot send an Authorization header, and the web app's tokens live in
	 * httpOnly cookies on another origin. So the browser asks (through its normal,
	 * authenticated API) for a ticket valid for one minute, and opens the stream with it.
	 * The ticket names a member of one shop; the stream re-checks that membership on open.
	 */
	issueTicket(
		membership: ResolvedMembership,
		userId: string
	): { ticket: string; expiresIn: number } {
		const body = Buffer.from(
			JSON.stringify({
				u: userId,
				b: membership.businessId,
				exp: Math.floor(Date.now() / 1000) + TICKET_TTL_SECONDS,
			})
		).toString("base64url");
		return { ticket: `${body}.${this.sign(body)}`, expiresIn: TICKET_TTL_SECONDS };
	}

	readTicket(
		ticket: string | undefined
	): { userId: string; businessId: string } | null {
		const [body, signature] = (ticket ?? "").split(".");
		if (!body || !signature) return null;
		const expected = Buffer.from(this.sign(body));
		const given = Buffer.from(signature);
		if (expected.length !== given.length || !timingSafeEqual(expected, given))
			return null;
		try {
			const claims = JSON.parse(Buffer.from(body, "base64url").toString()) as {
				u: string;
				b: string;
				exp: number;
			};
			if (claims.exp * 1000 < Date.now()) return null;
			return { userId: claims.u, businessId: claims.b };
		} catch {
			return null;
		}
	}

	private sign(body: string): string {
		const secret = this.config.get<string>("security.jwt.secret", "");
		return createHmac("sha256", `${secret}:realtime`)
			.update(body)
			.digest("base64url");
	}
}
