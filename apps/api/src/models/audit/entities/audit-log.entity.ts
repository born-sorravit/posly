import { BaseEntity } from "@/models/base.entity";
import { AuditAction } from "@/shared/enums/audit-action.enum";
import { Column, Entity, Index } from "typeorm";

/** Append-only record of sensitive actions: who, what, on which record, and why. */
@Entity("audit_log")
@Index("idx_audit_log_entity", ["businessId", "entity", "entityId"])
export class AuditLog extends BaseEntity {
	@Column({ name: "business_id", type: "uuid" })
	businessId: string;

	@Column({ name: "member_id", type: "uuid" })
	memberId: string;

	@Column({ name: "actor_name", type: "varchar", length: 120 })
	actorName: string;

	@Column({ type: "enum", enum: AuditAction })
	action: AuditAction;

	@Column({ type: "varchar", length: 40 })
	entity: string;

	@Column({ name: "entity_id", type: "uuid" })
	entityId: string;

	@Column({ type: "jsonb", default: {} })
	payload: Record<string, unknown>;
}
