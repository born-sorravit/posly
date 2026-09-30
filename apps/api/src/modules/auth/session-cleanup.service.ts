import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { DataSource } from "typeorm";

/** Revoked rows are kept this long first: enough to answer "why was I signed out?" */
const KEEP_REVOKED_DAYS = 30;
/** An expired row is dead the moment it expires; a week's margin costs nothing. */
const KEEP_EXPIRED_DAYS = 7;

/**
 * Deletes refresh tokens and password-reset links that can never be used again. Nothing else
 * removes them, so without this the tables only grow: every refresh adds a row.
 *
 * Runs on every API instance; the deletes are idempotent, so two instances racing is harmless.
 */
@Injectable()
export class SessionCleanupService {
	private readonly logger = new Logger(SessionCleanupService.name);

	constructor(private readonly dataSource: DataSource) {}

	@Cron("0 30 3 * * *", { name: "session-cleanup", timeZone: "Asia/Bangkok" })
	async run(): Promise<{ refreshTokens: number; passwordResets: number }> {
		try {
			const [, refreshTokens] = (await this.dataSource.query(
				`DELETE FROM refresh_token
				WHERE expires_at < now() - make_interval(days => $1::int)
				   OR revoked_at < now() - make_interval(days => $2::int)`,
				[KEEP_EXPIRED_DAYS, KEEP_REVOKED_DAYS]
			)) as [unknown, number];
			const [, passwordResets] = (await this.dataSource.query(
				`DELETE FROM password_reset
				WHERE expires_at < now() - make_interval(days => $1::int)
				   OR used_at < now() - make_interval(days => $1::int)`,
				[KEEP_EXPIRED_DAYS]
			)) as [unknown, number];
			if (refreshTokens || passwordResets) {
				this.logger.log(
					`Removed ${refreshTokens} refresh token(s) and ${passwordResets} password reset(s)`
				);
			}
			return { refreshTokens, passwordResets };
		} catch (error) {
			// A failed sweep only means the rows wait for tomorrow's.
			this.logger.warn(
				`Session cleanup failed: ${error instanceof Error ? error.message : error}`
			);
			return { refreshTokens: 0, passwordResets: 0 };
		}
	}
}
