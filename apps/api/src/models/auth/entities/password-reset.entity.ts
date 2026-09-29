import { BaseEntity } from "@/models/base.entity";
import { Column, Entity, Index } from "typeorm";

/**
 * A one-time password-reset link. Only the SHA-256 of the token is stored, like invites:
 * a leaked database row cannot be turned into a working link.
 */
@Entity("password_reset")
@Index("uq_password_reset_token", ["tokenHash"], { unique: true })
export class PasswordReset extends BaseEntity {
	@Index("idx_password_reset_user_id")
	@Column({ name: "user_id", type: "uuid" })
	userId: string;

	@Column({ name: "token_hash", type: "varchar", length: 64 })
	tokenHash: string;

	@Column({ name: "expires_at", type: "timestamptz" })
	expiresAt: Date;

	@Column({ name: "used_at", type: "timestamptz", nullable: true })
	usedAt: Date | null;
}
