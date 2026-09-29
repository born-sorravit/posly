import { BaseEntity } from "@/models/base.entity";
import { Business } from "@/models/businesses/entities/business.entity";
import { User } from "@/models/users/entities/user.entity";
import { MemberRole } from "@/shared/enums/member-role.enum";
import { MemberStatus } from "@/shared/enums/member-status.enum";
import type { Permission } from "@/shared/enums/permission.enum";
import { NotificationKind } from "@/shared/enums/notification.enum";
import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";

/**
 * A user's place in one business — the row every tenant check reads.
 *
 * `userId` is nullable because an invitation exists before the invitee has an account; the
 * email is what it is addressed to until then.
 */
@Entity("business_member")
@Index("uq_business_member_user", ["businessId", "userId"], {
	unique: true,
	where: "user_id IS NOT NULL AND deleted_at IS NULL",
})
@Index("uq_business_member_invite_token", ["inviteTokenHash"], {
	unique: true,
	where: "invite_token_hash IS NOT NULL",
})
@Index("uq_business_member_email", ["businessId", "email"], {
	unique: true,
	where: "deleted_at IS NULL",
})
export class BusinessMember extends BaseEntity {
	@Index("idx_business_member_business_id")
	@Column({ name: "business_id", type: "uuid" })
	businessId: string;

	@ManyToOne(() => Business, { onDelete: "CASCADE" })
	@JoinColumn({ name: "business_id" })
	business: Business;

	@Index("idx_business_member_user_id")
	@Column({ name: "user_id", type: "uuid", nullable: true })
	userId: string | null;

	@ManyToOne(() => User, { onDelete: "CASCADE", nullable: true })
	@JoinColumn({ name: "user_id" })
	user: User | null;

	@Column({ type: "varchar", length: 255 })
	email: string;

	/** Shown on receipts and reports; defaults to the user's name on accept. */
	@Column({ name: "display_name", type: "varchar", length: 120 })
	displayName: string;

	@Column({ type: "enum", enum: MemberRole })
	role: MemberRole;

	@Column({ type: "enum", enum: MemberStatus, default: MemberStatus.ACTIVE })
	status: MemberStatus;

	/**
	 * Overrides the role's default permissions when set. Null means "the role's defaults",
	 * so changing a role's defaults later reaches everyone who was never customised.
	 */
	@Column({ type: "jsonb", nullable: true })
	permissions: Permission[] | null;

	/**
	 * Branches this member may work in. Null means every branch — the MVP default, since the
	 * multi-branch UI is locked to the Business plan.
	 */
	@Column({ name: "branch_ids", type: "uuid", array: true, nullable: true })
	branchIds: string[] | null;

	/**
	 * SHA-256 of the one-time invitation token. The token itself exists only in the link the
	 * owner hands over; possession of that link — not merely registering the invited email,
	 * which nothing verifies — is what grants the membership.
	 */
	@Column({
		name: "invite_token_hash",
		type: "varchar",
		length: 64,
		nullable: true,
		select: false,
	})
	inviteTokenHash: string | null;

	@Column({ name: "invite_expires_at", type: "timestamptz", nullable: true })
	inviteExpiresAt: Date | null;

	/** bcrypt hash of a 4–6 digit POS PIN, for fast cashier switching (Phase 3). */
	@Column({
		name: "pin_hash",
		type: "varchar",
		length: 255,
		nullable: true,
		select: false,
	})
	pinHash: string | null;

	/** Wrong PINs in a row; five lock the PIN for a few minutes. */
	@Column({ name: "pin_failed_attempts", type: "int", default: 0 })
	pinFailedAttempts: number;

	@Column({ name: "pin_locked_until", type: "timestamptz", nullable: true })
	pinLockedUntil: Date | null;

	/**
	 * Left off the till's switch screen, and refused by PIN handover. For an owner who does not
	 * work the counter: a PIN that can be watched being typed there should not open their shop.
	 */
	@Column({ name: "hidden_from_switch", type: "boolean", default: false })
	hiddenFromSwitch: boolean;

	/** Notifications created after this are unread for this member; null = none read yet. */
	@Column({ name: "notifications_read_at", type: "timestamptz", nullable: true })
	notificationsReadAt: Date | null;

	/** Notification kinds this member switched off in settings; the rest they receive. */
	@Column({ name: "muted_notifications", type: "jsonb", default: [] })
	mutedNotifications: NotificationKind[];
}
