import { BusinessMemberRepository } from "@/models/businesses/business-member.repository";
import type { AuthenticatedUser } from "@/shared/decorators/current-user.decorator";
import {
	MEMBERSHIP_REQUEST_KEY,
	type ResolvedMembership,
} from "@/shared/decorators/current-membership.decorator";
import { PERMISSIONS_KEY } from "@/shared/decorators/require-permission.decorator";
import { IS_PUBLIC_KEY } from "@/shared/decorators/public.decorator";
import { MemberStatus } from "@/shared/enums/member-status.enum";
import { type Permission, resolvePermissions } from "@/shared/enums/permission.enum";
import {
	BadRequestException,
	CanActivate,
	ExecutionContext,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ScopedRequest {
	user?: AuthenticatedUser;
	params: Record<string, string | undefined>;
	[MEMBERSHIP_REQUEST_KEY]?: ResolvedMembership;
}

/**
 * The tenant boundary. Registered globally, after `JwtAuthGuard`.
 *
 * Any route with a `:businessId` param is scoped automatically — there is no decorator to
 * forget. The order is the plan's rule 40:
 *
 *   authenticated user → active membership in that business → permission → (the handler
 *   then scopes every query by `membership.businessId`)
 *
 * A caller who is not a member gets a **404**, not a 403: a 403 would confirm that a
 * business with that id exists. A member lacking a permission gets a 403, because they
 * already know the business exists.
 *
 * Routes keyed by a child id (`/orders/:orderId/refund`) have no `:businessId`; their
 * service must load the resource, read its `businessId`, and call `assertMembership` —
 * or, better, be nested under `/businesses/:businessId/...` so this guard covers them.
 */
@Injectable()
export class BusinessAccessGuard implements CanActivate {
	constructor(
		private readonly reflector: Reflector,
		private readonly memberRepository: BusinessMemberRepository
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			context.getHandler(),
			context.getClass(),
		]);
		if (isPublic) return true;

		const request = context.switchToHttp().getRequest<ScopedRequest>();
		const businessId = request.params?.businessId;
		const required =
			this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
				context.getHandler(),
				context.getClass(),
			]) ?? [];

		if (!businessId) {
			// A permission on an unscoped route could never be checked — refuse rather than
			// silently allowing it.
			if (required.length > 0) {
				throw new ForbiddenException("Permission check requires a business scope");
			}
			return true;
		}

		if (!UUID.test(businessId)) {
			throw new BadRequestException("Invalid business id");
		}
		if (!request.user) {
			throw new ForbiddenException("Insufficient permissions");
		}

		const membership = await this.assertMembership(request.user.id, businessId);

		const missing = required.filter((p) => !membership.permissions.includes(p));
		if (missing.length > 0) {
			throw new ForbiddenException("Insufficient permissions");
		}

		request[MEMBERSHIP_REQUEST_KEY] = membership;
		return true;
	}

	/**
	 * Re-read from the database on every request rather than trusted from the token: a
	 * cashier removed at 10:00 must not keep ringing up sales until their token expires.
	 */
	async assertMembership(
		userId: string,
		businessId: string
	): Promise<ResolvedMembership> {
		const member = await this.memberRepository.findOne({
			where: { userId, businessId, status: MemberStatus.ACTIVE },
			select: {
				id: true,
				businessId: true,
				role: true,
				permissions: true,
				branchIds: true,
			},
		});

		if (!member) {
			throw new NotFoundException("Business not found");
		}

		return {
			memberId: member.id,
			businessId: member.businessId,
			role: member.role,
			permissions: resolvePermissions(member.role, member.permissions),
			branchIds: member.branchIds,
		};
	}
}
