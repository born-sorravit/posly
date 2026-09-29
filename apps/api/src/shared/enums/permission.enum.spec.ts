import {
	normalizePermissions,
	Permission,
	resolvePermissions,
} from "@/shared/enums/permission.enum";
import { MemberRole } from "@/shared/enums/member-role.enum";

describe("normalizePermissions", () => {
	it("adds what each permission needs, transitively", () => {
		expect(normalizePermissions([Permission.ORDERS_DISCOUNT])).toEqual([
			Permission.PRODUCTS_READ,
			Permission.POS_USE,
			Permission.ORDERS_READ_OWN,
			Permission.ORDERS_DISCOUNT,
		]);
	});

	it("dedupes and keeps declaration order", () => {
		expect(
			normalizePermissions([
				Permission.REPORTS_READ,
				Permission.PRODUCTS_READ,
				Permission.REPORTS_READ,
			])
		).toEqual([Permission.PRODUCTS_READ, Permission.REPORTS_READ]);
	});

	it("never narrows the owner", () => {
		expect(resolvePermissions(MemberRole.OWNER, [])).toContain(
			Permission.SUBSCRIPTION_MANAGE
		);
	});
});
