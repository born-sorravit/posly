import { BusinessMemberRepository } from "@/models/businesses/business-member.repository";
import { BusinessMember } from "@/models/businesses/entities/business-member.entity";
import { BusinessRepository } from "@/models/businesses/business.repository";
import { UsersRepository } from "@/models/users/user.repository";
import {
	AcceptInviteResponse,
	InviteLinkResponse,
	InviteMemberDto,
	InvitePreviewResponse,
	MemberResponse,
	RosterEntryResponse,
	RolePermissionsResponse,
	SetPinDto,
	SetPermissionsDto,
	UpdateMemberDto,
} from "@/modules/members/dto/member.dto";
import { EntitlementsService } from "@/modules/subscriptions/entitlements.service";
import type { ResolvedMembership } from "@/shared/decorators/current-membership.decorator";
import { MemberRole } from "@/shared/enums/member-role.enum";
import { MemberStatus } from "@/shared/enums/member-status.enum";
import { OrderStatus } from "@/shared/enums/order.enum";
import {
	normalizePermissions,
	OWNER_ONLY,
	Permission,
	resolvePermissions,
	ROLE_PERMISSIONS,
} from "@/shared/enums/permission.enum";
import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	GoneException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { compare, hash } from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { DataSource, IsNull } from "typeorm";

const INVITE_TTL_DAYS = 7;

/** One digit throughout, or a straight run up or down: the first PINs anyone tries. */
export const isWeakPin = (pin: string): boolean => {
	const digits = [...pin].map(Number);
	const steps = digits.slice(1).map((d, i) => d - digits[i]);
	return (
		steps.every((s) => s === 0) ||
		steps.every((s) => s === 1) ||
		steps.every((s) => s === -1)
	);
};

const hashToken = (token: string) =>
	createHash("sha256").update(token).digest("hex");

/**
 * Staff of one business (plan §21).
 *
 * An invitation is a membership row with no user yet plus a **one-time token**. The owner
 * gets a link carrying the token and hands it to the employee (LINE, in person); opening it
 * while signed in attaches the membership. Registering with the invited email alone grants
 * nothing — nothing verifies that address, so whoever registered it first would otherwise
 * inherit the role, refunds and all.
 *
 * Only the token's SHA-256 is stored, it expires after seven days, and it is cleared the
 * moment it is used.
 */
@Injectable()
export class MembersService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly memberRepository: BusinessMemberRepository,
		private readonly businessRepository: BusinessRepository,
		private readonly usersRepository: UsersRepository,
		private readonly configService: ConfigService,
		private readonly entitlements: EntitlementsService
	) {}

	async findAll(membership: ResolvedMembership): Promise<MemberResponse[]> {
		const business = await this.businessRepository.findOneOrFail({
			where: { id: membership.businessId },
		});
		const members = await this.memberRepository.find({
			where: { businessId: membership.businessId },
			order: { createdAt: "ASC" },
		});

		const stats = (await this.dataSource.query(
			`SELECT member_id, MAX(created_at) AS last_at,
				COUNT(*) FILTER (WHERE status = $3 AND created_at >= date_trunc('day', now() AT TIME ZONE $2) AT TIME ZONE $2)::int AS today
			FROM "order" WHERE business_id = $1 GROUP BY member_id`,
			[membership.businessId, business.timezone, OrderStatus.PAID]
		)) as { member_id: string; last_at: Date | null; today: number }[];
		const byMember = new Map(stats.map((s) => [s.member_id, s]));
		const withPin = await this.membersWithPin(membership.businessId);

		return members.map((m) => ({
			...this.toResponse(m, byMember.get(m.id)),
			isYou: m.id === membership.memberId,
			hasPin: withPin.has(m.id),
		}));
	}

	/** `pin_hash` is never selected by default; this says only whether one exists. */
	private async membersWithPin(businessId: string): Promise<Set<string>> {
		const rows = (await this.dataSource.query(
			`SELECT id FROM business_member WHERE business_id = $1 AND pin_hash IS NOT NULL AND deleted_at IS NULL`,
			[businessId]
		)) as { id: string }[];
		return new Set(rows.map((r) => r.id));
	}

	/**
	 * Who can take over this till: active members with an account, and whether each has a
	 * PIN. Any member may read it — it is the lock screen's list of faces.
	 */
	async roster(membership: ResolvedMembership): Promise<RosterEntryResponse[]> {
		const members = await this.memberRepository.find({
			where: { businessId: membership.businessId, status: MemberStatus.ACTIVE },
			order: { createdAt: "ASC" },
		});
		const withPin = await this.membersWithPin(membership.businessId);
		return members
			.filter((m) => m.userId !== null)
			.map((m) => ({
				id: m.id,
				name: m.displayName,
				role: m.role,
				hasPin: withPin.has(m.id),
				isYou: m.id === membership.memberId,
			}));
	}

	/**
	 * Sets the caller's own PIN in this shop. A password account must confirm its password:
	 * a PIN opens this person's whole session, so someone at a till left signed in must not
	 * be able to plant one for later.
	 */
	async setMyPin(membership: ResolvedMembership, dto: SetPinDto): Promise<void> {
		if (isWeakPin(dto.pin)) {
			throw new BadRequestException("PIN is too easy to guess");
		}
		const member = await this.memberRepository.findOneOrFail({
			where: { id: membership.memberId },
		});
		const user = await this.usersRepository.findOne({
			where: { id: member.userId ?? "" },
			select: { id: true, passwordHash: true },
		});
		if (!user) throw new NotFoundException("Account not found");
		if (
			user.passwordHash &&
			!(await compare(dto.password ?? "", user.passwordHash))
		) {
			throw new ForbiddenException("Password is incorrect");
		}
		const rounds = this.configService.get<number>("security.bcryptRounds", 10);
		await this.memberRepository.update(
			{ id: member.id },
			{
				pinHash: await hash(dto.pin, rounds),
				pinFailedAttempts: 0,
				pinLockedUntil: null,
			}
		);
	}

	/** Removes a PIN: your own, or — with members:manage — someone else's who forgot theirs. */
	async clearPin(membership: ResolvedMembership, memberId: string): Promise<void> {
		const member = await this.memberRepository.findOne({
			where: { id: memberId, businessId: membership.businessId },
		});
		if (!member) throw new NotFoundException("Member not found");
		await this.memberRepository.update(
			{ id: member.id },
			{ pinHash: null, pinFailedAttempts: 0, pinLockedUntil: null }
		);
	}

	async invite(
		membership: ResolvedMembership,
		dto: InviteMemberDto
	): Promise<InviteLinkResponse> {
		const existing = await this.memberRepository.findOne({
			where: { businessId: membership.businessId, email: dto.email },
		});
		if (existing) throw new ConflictException("This email is already a member");
		// A pending invitation holds a seat: it becomes a member the moment it is accepted.
		await this.entitlements.assertMemberSeat(
			this.dataSource.manager,
			membership.businessId
		);

		const member = this.memberRepository.create({
			businessId: membership.businessId,
			userId: null,
			email: dto.email,
			displayName: dto.name,
			role: dto.role,
			status: MemberStatus.INVITED,
		});
		const link = this.issueToken(member);
		await this.memberRepository.save(member);
		return { member: this.toResponse(member), ...link };
	}

	/** A fresh link for a pending invite; the previous link stops working. */
	async regenerateLink(
		membership: ResolvedMembership,
		memberId: string
	): Promise<InviteLinkResponse> {
		const member = await this.memberRepository.findOne({
			where: { id: memberId, businessId: membership.businessId },
		});
		if (!member) throw new NotFoundException("Member not found");
		if (member.status !== MemberStatus.INVITED) {
			throw new BadRequestException("This member has already joined");
		}
		const link = this.issueToken(member);
		await this.memberRepository.save(member);
		return { member: this.toResponse(member), ...link };
	}

	/** What the invite page shows before anyone signs in. The token is the secret. */
	async preview(token: string): Promise<InvitePreviewResponse> {
		const member = await this.findByToken(token);
		const business = await this.businessRepository.findOneOrFail({
			where: { id: member.businessId },
		});
		return {
			businessName: business.name,
			role: member.role,
			invitedName: member.displayName,
			expiresAt: (member.inviteExpiresAt as Date).toISOString(),
		};
	}

	/**
	 * Attaches the invitation to the signed-in user. Single use: the token is cleared in the
	 * same update that activates the row, guarded on it still being there, so two browsers
	 * racing on one link cannot both join.
	 */
	async accept(userId: string, token: string): Promise<AcceptInviteResponse> {
		const member = await this.findByToken(token);

		const alreadyMember = await this.memberRepository.findOne({
			where: { businessId: member.businessId, userId },
		});
		if (alreadyMember)
			throw new ConflictException("You are already a member of this shop");

		const user = await this.usersRepository.findOneOrFail({ where: { id: userId } });
		const result = await this.memberRepository.update(
			{ id: member.id, inviteTokenHash: hashToken(token), userId: IsNull() },
			{
				userId,
				status: MemberStatus.ACTIVE,
				inviteTokenHash: null,
				inviteExpiresAt: null,
				// The account's own email from now on; the invited address was only a label.
				email: user.email,
			}
		);
		if (result.affected !== 1)
			throw new GoneException("This invitation has already been used");

		const business = await this.businessRepository.findOneOrFail({
			where: { id: member.businessId },
		});
		return {
			businessId: business.id,
			businessName: business.name,
			role: member.role,
		};
	}

	async update(
		membership: ResolvedMembership,
		memberId: string,
		dto: UpdateMemberDto
	): Promise<MemberResponse> {
		const member = await this.memberRepository.findOne({
			where: { id: memberId, businessId: membership.businessId },
		});
		if (!member) throw new NotFoundException("Member not found");
		if (member.role === MemberRole.OWNER) {
			throw new BadRequestException("The owner's role cannot be changed here");
		}
		if (dto.role && dto.role !== member.role) {
			member.role = dto.role;
			// A new role is a fresh start: a custom list tailored to the old one would
			// silently keep (or withhold) things the new role says otherwise.
			member.permissions = null;
		}
		if (
			dto.status === MemberStatus.ACTIVE &&
			member.status === MemberStatus.DISABLED
		) {
			// Re-enabling takes a seat back; disabling is always allowed.
			await this.entitlements.assertMemberSeat(
				this.dataSource.manager,
				membership.businessId
			);
		}
		if (dto.status && member.status !== MemberStatus.INVITED)
			member.status = dto.status;
		return this.toResponse(await this.memberRepository.save(member));
	}

	/** Role defaults and what a custom list may hold, for the permissions editor. */
	rolePermissions(): RolePermissionsResponse {
		return {
			roles: {
				[MemberRole.MANAGER]: [...ROLE_PERMISSIONS[MemberRole.MANAGER]],
				[MemberRole.CASHIER]: [...ROLE_PERMISSIONS[MemberRole.CASHIER]],
				[MemberRole.STAFF]: [...ROLE_PERMISSIONS[MemberRole.STAFF]],
			},
			assignable: Object.values(Permission).filter((p) => !OWNER_ONLY.includes(p)),
		};
	}

	/**
	 * Replaces one member's permissions (plan §21, Business plan). Three rules keep it from
	 * becoming a way around itself: the owner is never narrowed, nobody edits their own list,
	 * and nobody grants a permission they do not hold.
	 */
	async setPermissions(
		membership: ResolvedMembership,
		memberId: string,
		dto: SetPermissionsDto
	): Promise<MemberResponse> {
		const member = await this.memberRepository.findOne({
			where: { id: memberId, businessId: membership.businessId },
		});
		if (!member) throw new NotFoundException("Member not found");
		if (member.role === MemberRole.OWNER) {
			throw new BadRequestException("The owner always has every permission");
		}
		if (member.id === membership.memberId) {
			throw new ForbiddenException("You cannot change your own permissions");
		}

		if (dto.permissions === null || dto.permissions === undefined) {
			member.permissions = null;
		} else {
			if (dto.permissions.some((p) => OWNER_ONLY.includes(p))) {
				throw new BadRequestException("Billing stays with the owner");
			}
			const list = normalizePermissions(dto.permissions);
			const beyond = list.filter((p) => !membership.permissions.includes(p));
			if (beyond.length > 0) {
				throw new ForbiddenException(
					`You cannot grant what you do not have: ${beyond.join(", ")}`
				);
			}
			member.permissions = list;
		}
		return this.toResponse(await this.memberRepository.save(member));
	}

	/**
	 * Withdraws an invitation nobody has accepted yet. The row is soft-deleted and its token
	 * cleared, so the link dies at once and the email can be invited again. Members who
	 * joined are disabled instead, which keeps their name on past orders and audit rows.
	 */
	async cancelInvite(
		membership: ResolvedMembership,
		memberId: string
	): Promise<void> {
		const member = await this.memberRepository.findOne({
			where: { id: memberId, businessId: membership.businessId },
		});
		if (!member) throw new NotFoundException("Member not found");
		if (member.status !== MemberStatus.INVITED) {
			throw new BadRequestException("Only a pending invitation can be cancelled");
		}
		member.inviteTokenHash = null;
		member.inviteExpiresAt = null;
		await this.memberRepository.save(member);
		await this.memberRepository.softDelete({ id: member.id });
	}

	private issueToken(member: BusinessMember) {
		const token = randomBytes(32).toString("base64url");
		const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);
		member.inviteTokenHash = hashToken(token);
		member.inviteExpiresAt = expiresAt;
		const web = this.configService.get<string>(
			"app.publicWebUrl",
			"http://localhost:3000"
		);
		return {
			inviteUrl: `${web.replace(/\/+$/, "")}/invite/${token}`,
			expiresAt: expiresAt.toISOString(),
		};
	}

	/** Unknown and expired look the same from outside: 404 or 410, never which member. */
	private async findByToken(token: string): Promise<BusinessMember> {
		const member = await this.memberRepository.findOne({
			where: { inviteTokenHash: hashToken(token), status: MemberStatus.INVITED },
		});
		if (!member) throw new NotFoundException("Invitation not found");
		if (!member.inviteExpiresAt || member.inviteExpiresAt.getTime() < Date.now()) {
			throw new GoneException("This invitation has expired");
		}
		return member;
	}

	private toResponse(
		m: BusinessMember,
		stats?: { last_at: Date | null; today: number }
	): MemberResponse {
		return {
			id: m.id,
			name: m.displayName,
			email: m.email,
			role: m.role,
			status: m.status,
			lastActiveAt: stats?.last_at ? new Date(stats.last_at).toISOString() : null,
			ordersToday: stats?.today ?? 0,
			inviteExpiresAt: m.inviteExpiresAt?.toISOString() ?? null,
			permissions: [...resolvePermissions(m.role, m.permissions)],
			customPermissions: m.role !== MemberRole.OWNER && m.permissions !== null,
		};
	}
}
