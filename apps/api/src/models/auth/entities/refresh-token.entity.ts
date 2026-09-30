import { BaseEntity } from "@/models/base.entity";
import { User } from "@/models/users/entities/user.entity";
import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";

export type AuthMethod = "password" | "google" | "pin" | "demo";

/**
 * One row per issued refresh token.
 *
 * Only the SHA-256 hash of the token is stored, the same way a password is: a database leak
 * then yields nothing usable. Tokens rotate on every refresh — the old row is revoked and a
 * new one issued — so a stolen token stops working as soon as the real client refreshes.
 */
@Entity("refresh_token")
export class RefreshToken extends BaseEntity {
	@Index("uq_refresh_token_hash", { unique: true })
	@Column({ name: "token_hash", type: "varchar", length: 64 })
	tokenHash: string;

	@Index("idx_refresh_token_user_id")
	@Column({ name: "user_id", type: "uuid" })
	userId: string;

	@ManyToOne(() => User, { onDelete: "CASCADE" })
	@JoinColumn({ name: "user_id" })
	user: User;

	/**
	 * One per sign-in: every token rotated from the same login shares it. A browser that
	 * refreshes from several requests at once can be handed more than one successor inside
	 * the reuse grace window; the family lets the next rotation retire the extras.
	 */
	@Index("idx_refresh_token_family_active", { where: '"revoked_at" IS NULL' })
	@Column({ name: "family_id", type: "uuid", default: () => "uuid_generate_v4()" })
	familyId: string;

	/** How the sign-in was proven; the admin monitor requires "google" (plan: admin hardening). */
	@Column({ name: "auth_method", type: "varchar", length: 16, default: "password" })
	authMethod: AuthMethod;

	@Column({ name: "expires_at", type: "timestamptz" })
	expiresAt: Date;

	/** Set when the token is rotated away or the session is signed out. */
	@Column({ name: "revoked_at", type: "timestamptz", nullable: true })
	revokedAt: Date | null;

	/**
	 * Why the token was revoked, which decides whether a late arrival gets a grace period.
	 *
	 * `rotated` means a refresh replaced it — and a browser that fired several requests at
	 * once may still be holding it, so a reuse within seconds is a race, not a theft.
	 * `logout` means the user asked to end the session, which is never forgiven.
	 * `password` means a password change ended every session at once — also never forgiven.
	 * `admin` means a platform admin signed the account out everywhere — never forgiven.
	 * `superseded` means a sibling from a concurrent refresh that the client never kept,
	 * retired at the family's next rotation — never forgiven.
	 */
	@Column({ name: "revoked_reason", type: "varchar", length: 16, nullable: true })
	revokedReason: "rotated" | "logout" | "password" | "admin" | "superseded" | null;

	/** Best-effort context for a "your sessions" screen later; never used for auth. */
	@Column({ name: "user_agent", type: "varchar", length: 255, nullable: true })
	userAgent: string | null;
}
