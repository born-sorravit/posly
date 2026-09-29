import type { MemberRole } from "@/shared/enums/member-role.enum";
import type { Permission } from "@/shared/enums/permission.enum";
import {
	ExecutionContext,
	InternalServerErrorException,
	createParamDecorator,
} from "@nestjs/common";

/**
 * Who the caller is **in this business**, verified against the database for this request.
 *
 * `businessId` here is the one the guard checked membership for — handlers scope every query
 * by this value, never by a raw `:businessId` param or a body field.
 */
export interface ResolvedMembership {
	memberId: string;
	businessId: string;
	role: MemberRole;
	permissions: readonly Permission[];
	/** Null = every branch. */
	branchIds: string[] | null;
}

export const MEMBERSHIP_REQUEST_KEY = "membership";

export const CurrentMembership = createParamDecorator(
	(_data: unknown, context: ExecutionContext): ResolvedMembership => {
		const request = context
			.switchToHttp()
			.getRequest<{ [MEMBERSHIP_REQUEST_KEY]?: ResolvedMembership }>();
		const membership = request[MEMBERSHIP_REQUEST_KEY];
		// A handler asking for a membership on a route the guard did not scope is a wiring
		// bug, and failing loudly beats running a query with an undefined tenant.
		if (!membership) {
			throw new InternalServerErrorException(
				"CurrentMembership used on a route without a :businessId"
			);
		}
		return membership;
	}
);
