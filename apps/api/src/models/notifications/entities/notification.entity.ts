import { BaseEntity } from "@/models/base.entity";
import { Business } from "@/models/businesses/entities/business.entity";
import { NotificationKind } from "@/shared/enums/notification.enum";
import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";

/**
 * Something a shop's staff should know about (plan §28): stock running out, money going
 * back, yesterday's takings. One row per shop, not per person — who may see it follows from
 * permissions, and "read" is each member's `notificationsReadAt`.
 */
@Entity("notification")
@Index("idx_notification_business_created", ["businessId", "createdAt"])
@Index("uq_notification_dedupe", ["businessId", "dedupeKey"], {
	unique: true,
	where: "dedupe_key IS NOT NULL",
})
export class Notification extends BaseEntity {
	@Column({ name: "business_id", type: "uuid" })
	businessId: string;

	@ManyToOne(() => Business, { onDelete: "CASCADE" })
	@JoinColumn({ name: "business_id" })
	business: Business;

	/** Null = the whole shop; otherwise only members who can see this branch. */
	@Column({ name: "branch_id", type: "uuid", nullable: true })
	branchId: string | null;

	@Column({ type: "enum", enum: NotificationKind })
	kind: NotificationKind;

	/** The product or order it is about, for the client to link to. */
	@Column({ name: "entity_id", type: "uuid", nullable: true })
	entityId: string | null;

	@Column({ type: "jsonb", default: {} })
	data: Record<string, unknown>;

	/** Set for events that must happen once, e.g. `daily:2026-09-28`. */
	@Column({ name: "dedupe_key", type: "varchar", length: 80, nullable: true })
	dedupeKey: string | null;
}
