import {
	AdminAnnouncementAudienceDto,
	AdminAnnouncementDto,
	AdminCreateNoteDto,
	AdminNoteRow,
	AdminNotesQueryDto,
	AdminSearchResponse,
} from "@/modules/admin/dto/admin.dto";
import { NotificationsService } from "@/modules/notifications/notifications.service";
import type { AuthenticatedUser } from "@/shared/decorators/current-user.decorator";
import { MemberRole } from "@/shared/enums/member-role.enum";
import { NotificationKind } from "@/shared/enums/notification.enum";
import { SubscriptionStatus } from "@/shared/enums/subscription.enum";
import { DEMO_EMAIL_DOMAIN } from "@/shared/utils/demo.util";
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEMO_LIKE = `'%@${DEMO_EMAIL_DOMAIN}'`;
const SEARCH_LIMIT = 6;

/** `%term%` with LIKE's own wildcards escaped. */
const contains = (term: string) => `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
const iso = (value: unknown) => new Date(value as string).toISOString();

const isDemoShop = (alias: string) => `EXISTS (
	SELECT 1 FROM business_member dm JOIN "user" du ON du.id = dm.user_id
	WHERE dm.business_id = ${alias}.id AND dm.role = '${MemberRole.OWNER}'
	  AND dm.deleted_at IS NULL AND du.email ILIKE ${DEMO_LIKE})`;

/**
 * The admin monitor's support tools: one search box across shops, people and orders; notes
 * the team keeps on a shop or an account; and announcements sent into shops' notifications.
 */
@Injectable()
export class AdminSupportService {
	constructor(
		@InjectDataSource() private readonly dataSource: DataSource,
		private readonly notifications: NotificationsService
	) {}

	/**
	 * Everything that matches, a few of each. Demo data is included: an admin typing a name
	 * wants that thing, whatever it is. An order is found by its id, or by "#123" / "123",
	 * which is only unique per shop, so the newest few with that number are shown.
	 */
	async search(raw: string): Promise<AdminSearchResponse> {
		const q = raw.trim();
		const like = contains(q);
		const ownerEmail = `(SELECT u.email FROM business_member m JOIN "user" u ON u.id = m.user_id
			WHERE m.business_id = b.id AND m.role = '${MemberRole.OWNER}' AND m.deleted_at IS NULL
			ORDER BY m.created_at LIMIT 1)`;

		const businesses = await this.dataSource.query(
			`SELECT b.id, b.name, ${ownerEmail} AS "ownerEmail", s.plan_code AS plan, ${isDemoShop("b")} AS "isDemo"
			FROM business b
			LEFT JOIN subscription s ON s.business_id = b.id AND s.deleted_at IS NULL
			WHERE b.deleted_at IS NULL AND (b.name ILIKE $1 OR b.id::text = $2 OR ${ownerEmail} ILIKE $1)
			ORDER BY (b.name ILIKE $3) DESC, b.created_at DESC
			LIMIT ${SEARCH_LIMIT}`,
			[like, q, `${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`]
		);

		const users = await this.dataSource.query(
			`SELECT u.id, u.email, u.name, (u.email ILIKE ${DEMO_LIKE}) AS "isDemo"
			FROM "user" u
			WHERE u.deleted_at IS NULL AND (u.email ILIKE $1 OR u.name ILIKE $1 OR u.id::text = $2)
			ORDER BY u.created_at DESC
			LIMIT ${SEARCH_LIMIT}`,
			[like, q]
		);

		const number = /^#?(\d{1,9})$/.exec(q)?.[1];
		const orders =
			UUID.test(q) || number
				? await this.dataSource.query(
						`SELECT o.id, o.business_id AS "businessId", b.name AS "businessName", o.number,
							o.status, o.total, o.created_at AS "createdAt"
						FROM "order" o JOIN business b ON b.id = o.business_id
						WHERE o.deleted_at IS NULL AND ${UUID.test(q) ? "o.id = $1" : "o.number = $1"}
						ORDER BY o.created_at DESC
						LIMIT ${SEARCH_LIMIT}`,
						[UUID.test(q) ? q : Number(number)]
					)
				: [];

		return {
			businesses: businesses.map((row: Record<string, unknown>) => ({
				id: row.id as string,
				name: row.name as string,
				ownerEmail: (row.ownerEmail as string) ?? null,
				plan: (row.plan as string) ?? null,
				isDemo: Boolean(row.isDemo),
			})),
			users: users.map((row: Record<string, unknown>) => ({
				id: row.id as string,
				email: row.email as string,
				name: row.name as string,
				isDemo: Boolean(row.isDemo),
			})),
			orders: orders.map((row: Record<string, unknown>) => ({
				id: row.id as string,
				businessId: row.businessId as string,
				businessName: row.businessName as string,
				number: Number(row.number),
				status: row.status as string,
				total: Number(row.total),
				createdAt: iso(row.createdAt),
			})),
		};
	}

	async notes(query: AdminNotesQueryDto): Promise<AdminNoteRow[]> {
		const rows = await this.dataSource.query(
			`SELECT id, admin_user_id AS "adminUserId", admin_email AS "adminEmail", body, created_at AS "createdAt"
			FROM admin_note
			WHERE target_type = $1 AND target_id = $2 AND deleted_at IS NULL
			ORDER BY created_at DESC
			LIMIT 100`,
			[query.targetType, query.targetId]
		);
		return rows.map(toNote);
	}

	async createNote(
		admin: AuthenticatedUser,
		dto: AdminCreateNoteDto
	): Promise<AdminNoteRow> {
		const table = dto.targetType === "business" ? "business" : `"user"`;
		const [target] = await this.dataSource.query(
			`SELECT id FROM ${table} WHERE id = $1 AND deleted_at IS NULL`,
			[dto.targetId]
		);
		if (!target) throw new NotFoundException(`${dto.targetType} not found`);

		const [row] = await this.dataSource.query(
			`INSERT INTO admin_note (admin_user_id, admin_email, target_type, target_id, body)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id, admin_user_id AS "adminUserId", admin_email AS "adminEmail", body, created_at AS "createdAt"`,
			[admin.id, admin.email, dto.targetType, dto.targetId, dto.body.trim()]
		);
		return toNote(row);
	}

	/** Only its author removes a note: the others' record of what was agreed stays theirs. */
	async deleteNote(admin: AuthenticatedUser, id: string): Promise<void> {
		const [note] = await this.dataSource.query(
			`SELECT admin_user_id AS "adminUserId" FROM admin_note WHERE id = $1 AND deleted_at IS NULL`,
			[id]
		);
		if (!note) throw new NotFoundException("Note not found");
		if (note.adminUserId !== admin.id) {
			throw new ForbiddenException("Only the note's author can delete it");
		}
		await this.dataSource.query(
			`UPDATE admin_note SET deleted_at = now(), updated_at = now() WHERE id = $1`,
			[id]
		);
	}

	/** How many shops an announcement with this audience would reach. */
	async audienceSize(
		audience: AdminAnnouncementAudienceDto
	): Promise<{ shops: number }> {
		const [{ n }] = await this.dataSource.query(
			`SELECT COUNT(*)::int AS n FROM (${this.audienceSql(audience)}) a`,
			audience.plan ? [audience.plan] : []
		);
		return { shops: n };
	}

	/**
	 * Drops the message into every targeted shop's notifications, one transaction, and logs
	 * it once. Each shop's copy carries the same dedupe key, so a retried request sends
	 * nothing twice. Members see it like any other notification (and can mute the kind).
	 */
	async announce(
		admin: AuthenticatedUser,
		dto: AdminAnnouncementDto
	): Promise<{ sent: number }> {
		const id = randomUUID();
		const shops = (await this.dataSource.query(
			this.audienceSql(dto),
			dto.plan ? [dto.plan] : []
		)) as { id: string }[];

		await this.dataSource.transaction(async (manager) => {
			for (const shop of shops) {
				await this.notifications.emit(
					manager,
					shop.id,
					NotificationKind.ANNOUNCEMENT,
					{ title: dto.title.trim(), body: dto.body.trim() },
					{ dedupeKey: `announcement:${id}` }
				);
			}
			await manager.query(
				`INSERT INTO admin_action_log (admin_user_id, admin_email, action, target_type, target_id, payload)
				VALUES ($1, $2, 'ANNOUNCEMENT_SENT', 'announcement', $3, $4)`,
				[
					admin.id,
					admin.email,
					id,
					JSON.stringify({
						title: dto.title.trim(),
						body: dto.body.trim(),
						plan: dto.plan ?? null,
						includeDemo: dto.includeDemo,
						shops: shops.length,
					}),
				]
			);
		});
		return { sent: shops.length };
	}

	/** Live shops, on `plan` when given (as their subscription row says), demo excluded unless asked. */
	private audienceSql(audience: AdminAnnouncementAudienceDto): string {
		return `SELECT b.id FROM business b
			LEFT JOIN subscription s ON s.business_id = b.id AND s.deleted_at IS NULL
			WHERE b.deleted_at IS NULL
			${audience.plan ? `AND s.plan_code = $1 AND s.status IN ('${SubscriptionStatus.ACTIVE}', '${SubscriptionStatus.TRIALING}')` : ""}
			${audience.includeDemo ? "" : `AND NOT ${isDemoShop("b")}`}`;
	}
}

const toNote = (row: Record<string, unknown>): AdminNoteRow => ({
	id: row.id as string,
	adminUserId: row.adminUserId as string,
	adminEmail: row.adminEmail as string,
	body: row.body as string,
	createdAt: iso(row.createdAt),
});
