import type { BusinessMemberRepository } from "@/models/businesses/business-member.repository";
import { MEMBERSHIP_REQUEST_KEY } from "@/shared/decorators/current-membership.decorator";
import { MemberRole } from "@/shared/enums/member-role.enum";
import { Permission } from "@/shared/enums/permission.enum";
import { BusinessAccessGuard } from "@/shared/guards/business-access.guard";
import {
	type ExecutionContext,
	ForbiddenException,
	NotFoundException,
} from "@nestjs/common";
import type { Reflector } from "@nestjs/core";

const BUSINESS_ID = "3f1c2a4e-9b7d-4c1e-8a2f-5d6e7f8a9b0c";

const build = (options: {
	member?: { role: MemberRole; permissions?: Permission[] | null } | null;
	required?: Permission[];
	params?: Record<string, string>;
}) => {
	const findOne = jest.fn().mockResolvedValue(
		options.member === null || options.member === undefined
			? null
			: {
					id: "member-1",
					businessId: BUSINESS_ID,
					role: options.member.role,
					permissions: options.member.permissions ?? null,
					branchIds: null,
				}
	);
	const reflector = {
		getAllAndOverride: (key: string) =>
			key === "permissions" ? options.required : undefined,
	};
	const request: Record<string, unknown> = {
		user: { id: "user-1", email: "a@x.co" },
		params: options.params ?? { businessId: BUSINESS_ID },
	};
	const context = {
		getHandler: () => undefined,
		getClass: () => undefined,
		switchToHttp: () => ({ getRequest: () => request }),
	} as unknown as ExecutionContext;

	const guard = new BusinessAccessGuard(
		reflector as unknown as Reflector,
		{ findOne } as unknown as BusinessMemberRepository
	);
	return { guard, context, request, findOne };
};

describe("BusinessAccessGuard", () => {
	it("answers 404 to a non-member so the business's existence is not confirmed", async () => {
		const { guard, context } = build({ member: null });
		await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
			NotFoundException
		);
	});

	it("attaches the verified membership for the handler to scope by", async () => {
		const { guard, context, request } = build({
			member: { role: MemberRole.OWNER },
		});
		await expect(guard.canActivate(context)).resolves.toBe(true);
		expect(request[MEMBERSHIP_REQUEST_KEY]).toMatchObject({
			businessId: BUSINESS_ID,
			role: MemberRole.OWNER,
		});
	});

	it("refuses a cashier a manager-only permission", async () => {
		const { guard, context } = build({
			member: { role: MemberRole.CASHIER },
			required: [Permission.ORDERS_REFUND],
		});
		await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
			ForbiddenException
		);
	});

	it("honours a STAFF member's custom permission list", async () => {
		const { guard, context } = build({
			member: { role: MemberRole.STAFF, permissions: [Permission.POS_USE] },
			required: [Permission.POS_USE],
		});
		await expect(guard.canActivate(context)).resolves.toBe(true);
	});

	it("never lets a custom list narrow an OWNER", async () => {
		const { guard, context } = build({
			member: { role: MemberRole.OWNER, permissions: [] },
			required: [Permission.MEMBERS_MANAGE],
		});
		await expect(guard.canActivate(context)).resolves.toBe(true);
	});

	it("only looks up active memberships", async () => {
		const { guard, context, findOne } = build({
			member: { role: MemberRole.OWNER },
		});
		await guard.canActivate(context);
		expect(findOne).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ userId: "user-1", status: "ACTIVE" }),
			})
		);
	});

	it("refuses a permission requirement on a route with no business scope", async () => {
		const { guard, context } = build({
			member: { role: MemberRole.OWNER },
			required: [Permission.POS_USE],
			params: {},
		});
		await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
			ForbiddenException
		);
	});
});
