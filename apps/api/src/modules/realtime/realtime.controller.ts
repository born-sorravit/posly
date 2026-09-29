import { BusinessMember } from "@/models/businesses/entities/business-member.entity";
import { RealtimeService } from "@/modules/realtime/realtime.service";
import { CurrentMembership } from "@/shared/decorators/current-membership.decorator";
import type { ResolvedMembership } from "@/shared/decorators/current-membership.decorator";
import { CurrentUser } from "@/shared/decorators/current-user.decorator";
import type { AuthenticatedUser } from "@/shared/decorators/current-user.decorator";
import { Public } from "@/shared/decorators/public.decorator";
import { MemberStatus } from "@/shared/enums/member-status.enum";
import { resolvePermissions } from "@/shared/enums/permission.enum";
import {
	Controller,
	HttpCode,
	type MessageEvent,
	Post,
	Query,
	Sse,
	UnauthorizedException,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { filter, interval, map, merge, type Observable, of } from "rxjs";
import { DataSource } from "typeorm";

/** Comment-only keep-alive: proxies drop a connection that stays silent for a minute. */
const HEARTBEAT_MS = 25_000;

@ApiTags("realtime")
@Controller()
export class RealtimeController {
	constructor(
		private readonly realtime: RealtimeService,
		private readonly dataSource: DataSource
	) {}

	@Post("businesses/:businessId/realtime/ticket")
	@HttpCode(200)
	@ApiBearerAuth()
	@ApiOperation({
		summary: "A one-minute ticket to open this shop's live-update stream",
	})
	ticket(
		@CurrentMembership() m: ResolvedMembership,
		@CurrentUser() user: AuthenticatedUser
	): { ticket: string; expiresIn: number } {
		return this.realtime.issueTicket(m, user.id);
	}

	/**
	 * The live stream: `event: kitchen | orders | notifications` whenever one of those changes
	 * for this member's shop and branches. Events carry no data — the client re-reads through
	 * the API, which applies every permission as usual.
	 */
	@Public()
	@SkipThrottle()
	@Sse("realtime/stream")
	@ApiOperation({ summary: "Server-Sent Events for one shop; open with a ticket" })
	async stream(
		@Query("ticket") ticket: string | undefined
	): Promise<Observable<MessageEvent>> {
		const claims = this.realtime.readTicket(ticket);
		if (!claims) throw new UnauthorizedException("Invalid or expired ticket");
		const member = await this.dataSource.getRepository(BusinessMember).findOne({
			where: {
				userId: claims.userId,
				businessId: claims.businessId,
				status: MemberStatus.ACTIVE,
			},
		});
		if (!member) throw new UnauthorizedException("Not a member of this shop");
		const membership: ResolvedMembership = {
			memberId: member.id,
			businessId: member.businessId,
			role: member.role,
			permissions: resolvePermissions(member.role, member.permissions),
			branchIds: member.branchIds,
		};

		return merge(
			of<MessageEvent>({ type: "ready", data: { ok: true } }),
			this.realtime.events.pipe(
				filter((event) => RealtimeService.visibleTo(event, membership)),
				map(
					(event): MessageEvent => ({
						type: event.topic,
						data: { topic: event.topic },
					})
				)
			),
			interval(HEARTBEAT_MS).pipe(
				map((): MessageEvent => ({ type: "ping", data: "" }))
			)
		);
	}
}
