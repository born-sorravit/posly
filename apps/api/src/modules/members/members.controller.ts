import {
	AcceptInviteDto,
	AcceptInviteResponse,
	InviteLinkResponse,
	InviteMemberDto,
	InvitePreviewResponse,
	MemberResponse,
	RolePermissionsResponse,
	RosterEntryResponse,
	SetPermissionsDto,
	SetPinDto,
	UpdateMemberDto,
} from "@/modules/members/dto/member.dto";
import { MembersService } from "@/modules/members/members.service";
import { DemoBlocked } from "@/shared/decorators/demo-blocked.decorator";
import { CurrentMembership } from "@/shared/decorators/current-membership.decorator";
import type { ResolvedMembership } from "@/shared/decorators/current-membership.decorator";
import { CurrentUser } from "@/shared/decorators/current-user.decorator";
import type { AuthenticatedUser } from "@/shared/decorators/current-user.decorator";
import { Public } from "@/shared/decorators/public.decorator";
import { RequireFeature } from "@/shared/decorators/require-feature.decorator";
import { RequirePermission } from "@/shared/decorators/require-permission.decorator";
import { Feature } from "@/shared/enums/subscription.enum";
import { Permission } from "@/shared/enums/permission.enum";
import {
	Body,
	Controller,
	Get,
	Delete,
	HttpCode,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Put,
} from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

@ApiTags("members")
@ApiBearerAuth()
@Controller("businesses/:businessId/members")
export class MembersController {
	constructor(private readonly membersService: MembersService) {}

	@Get()
	@RequirePermission(Permission.MEMBERS_MANAGE)
	@ApiOkResponse({ type: [MemberResponse] })
	findAll(@CurrentMembership() m: ResolvedMembership): Promise<MemberResponse[]> {
		return this.membersService.findAll(m);
	}

	@Post()
	@DemoBlocked()
	@RequirePermission(Permission.MEMBERS_MANAGE)
	@ApiOperation({
		summary: "Invite an employee; returns a one-time link to hand them",
	})
	@ApiOkResponse({ type: InviteLinkResponse })
	invite(
		@CurrentMembership() m: ResolvedMembership,
		@Body() dto: InviteMemberDto
	): Promise<InviteLinkResponse> {
		return this.membersService.invite(m, dto);
	}

	@Post(":memberId/invite-link")
	@DemoBlocked()
	@HttpCode(200)
	@RequirePermission(Permission.MEMBERS_MANAGE)
	@ApiOperation({ summary: "Issue a new invite link; the old one stops working" })
	@ApiOkResponse({ type: InviteLinkResponse })
	regenerateLink(
		@CurrentMembership() m: ResolvedMembership,
		@Param("memberId", ParseUUIDPipe) memberId: string
	): Promise<InviteLinkResponse> {
		return this.membersService.regenerateLink(m, memberId);
	}

	@Get("roster")
	@ApiOperation({
		summary:
			"Active members who can take over this till, and whether they have a PIN",
	})
	@ApiOkResponse({ type: [RosterEntryResponse] })
	roster(
		@CurrentMembership() m: ResolvedMembership
	): Promise<RosterEntryResponse[]> {
		return this.membersService.roster(m);
	}

	@Put("me/pin")
	@DemoBlocked()
	@HttpCode(204)
	@Throttle({ default: { limit: 10, ttl: 60_000 } })
	@ApiOperation({ summary: "Set your own quick-switch PIN for this shop" })
	setMyPin(
		@CurrentMembership() m: ResolvedMembership,
		@Body() dto: SetPinDto
	): Promise<void> {
		return this.membersService.setMyPin(m, dto);
	}

	@Delete("me/pin")
	@DemoBlocked()
	@HttpCode(204)
	@ApiOperation({ summary: "Remove your own PIN" })
	clearMyPin(@CurrentMembership() m: ResolvedMembership): Promise<void> {
		return this.membersService.clearPin(m, m.memberId);
	}

	@Delete(":memberId/pin")
	@DemoBlocked()
	@HttpCode(204)
	@RequirePermission(Permission.MEMBERS_MANAGE)
	@ApiOperation({ summary: "Clear someone's PIN (they forgot it)" })
	clearPin(
		@CurrentMembership() m: ResolvedMembership,
		@Param("memberId", ParseUUIDPipe) memberId: string
	): Promise<void> {
		return this.membersService.clearPin(m, memberId);
	}

	@Get("roles")
	@RequirePermission(Permission.MEMBERS_MANAGE)
	@ApiOperation({
		summary: "Role defaults and assignable permissions, for the editor",
	})
	@ApiOkResponse({ type: RolePermissionsResponse })
	roles(): RolePermissionsResponse {
		return this.membersService.rolePermissions();
	}

	@Put(":memberId/permissions")
	@DemoBlocked()
	@RequirePermission(Permission.MEMBERS_MANAGE)
	@RequireFeature(Feature.ADVANCED_PERMISSION)
	@ApiOperation({ summary: "Set one member's own permission list (Business plan)" })
	@ApiOkResponse({ type: MemberResponse })
	setPermissions(
		@CurrentMembership() m: ResolvedMembership,
		@Param("memberId", ParseUUIDPipe) memberId: string,
		@Body() dto: SetPermissionsDto
	): Promise<MemberResponse> {
		return this.membersService.setPermissions(m, memberId, dto);
	}

	@Patch(":memberId")
	@DemoBlocked()
	@RequirePermission(Permission.MEMBERS_MANAGE)
	@ApiOkResponse({ type: MemberResponse })
	update(
		@CurrentMembership() m: ResolvedMembership,
		@Param("memberId", ParseUUIDPipe) memberId: string,
		@Body() dto: UpdateMemberDto
	): Promise<MemberResponse> {
		return this.membersService.update(m, memberId, dto);
	}

	@Delete(":memberId")
	@DemoBlocked()
	@HttpCode(200)
	@RequirePermission(Permission.MEMBERS_MANAGE)
	@ApiOperation({
		summary: "Cancel a pending invitation; joined members are disabled instead",
	})
	async cancelInvite(
		@CurrentMembership() m: ResolvedMembership,
		@Param("memberId", ParseUUIDPipe) memberId: string
	): Promise<{ cancelled: true }> {
		await this.membersService.cancelInvite(m, memberId);
		return { cancelled: true };
	}
}

/** Invite links are not business-scoped: the token identifies the shop. */
const INVITE_THROTTLE = { default: { limit: 20, ttl: 60_000 } };

@ApiTags("members")
@Controller("invites")
export class InvitesController {
	constructor(private readonly membersService: MembersService) {}

	@Public()
	@Throttle(INVITE_THROTTLE)
	@Get(":token")
	@ApiOperation({ summary: "Which shop and role an invite link is for" })
	@ApiOkResponse({ type: InvitePreviewResponse })
	preview(@Param("token") token: string): Promise<InvitePreviewResponse> {
		return this.membersService.preview(token);
	}

	@Throttle(INVITE_THROTTLE)
	@Post("accept")
	@HttpCode(200)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Join the shop an invite link is for (single use)" })
	@ApiOkResponse({ type: AcceptInviteResponse })
	accept(
		@CurrentUser() user: AuthenticatedUser,
		@Body() dto: AcceptInviteDto
	): Promise<AcceptInviteResponse> {
		return this.membersService.accept(user.id, dto.token);
	}
}
