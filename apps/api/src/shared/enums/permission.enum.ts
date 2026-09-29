import { MemberRole } from "@/shared/enums/member-role.enum";

/**
 * What a route actually needs, as opposed to who is asking.
 *
 * Routes declare permissions, never roles: `@RequirePermission(Permission.PRODUCTS_WRITE)`
 * rather than `@Roles(OWNER, MANAGER)`. That is what lets STAFF have "permissions as
 * assigned" and a future custom-role screen work without touching a single controller.
 */
export enum Permission {
	BUSINESS_MANAGE = "business:manage",
	BRANCHES_MANAGE = "branches:manage",
	MEMBERS_MANAGE = "members:manage",
	SUBSCRIPTION_MANAGE = "subscription:manage",
	SETTINGS_MANAGE = "settings:manage",

	PRODUCTS_READ = "products:read",
	PRODUCTS_WRITE = "products:write",
	INVENTORY_WRITE = "inventory:write",

	POS_USE = "pos:use",
	ORDERS_READ_OWN = "orders:read-own",
	ORDERS_READ_ALL = "orders:read-all",
	ORDERS_REFUND = "orders:refund",
	ORDERS_CANCEL = "orders:cancel",
	/** Giving any discount at checkout. Without it the till can only charge full price. */
	ORDERS_DISCOUNT = "orders:discount",

	/** The kitchen screen: see tickets, tick lines off, mark orders ready and served. */
	KITCHEN_USE = "kitchen:use",

	REPORTS_READ = "reports:read",
	EXPENSES_WRITE = "expenses:write",
	CUSTOMERS_WRITE = "customers:write",
}

const ALL = Object.values(Permission);

/**
 * The defaults each role starts with. A member's own `permissions` column, when set,
 * replaces this list for that member — which is how STAFF gets a tailored set.
 */
export const ROLE_PERMISSIONS: Record<MemberRole, readonly Permission[]> = {
	[MemberRole.OWNER]: ALL,
	[MemberRole.MANAGER]: [
		Permission.PRODUCTS_READ,
		Permission.PRODUCTS_WRITE,
		Permission.INVENTORY_WRITE,
		Permission.POS_USE,
		Permission.ORDERS_READ_OWN,
		Permission.ORDERS_READ_ALL,
		Permission.ORDERS_REFUND,
		Permission.ORDERS_CANCEL,
		Permission.ORDERS_DISCOUNT,
		Permission.KITCHEN_USE,
		Permission.REPORTS_READ,
		Permission.EXPENSES_WRITE,
		Permission.CUSTOMERS_WRITE,
	],
	[MemberRole.CASHIER]: [
		Permission.PRODUCTS_READ,
		Permission.POS_USE,
		Permission.ORDERS_READ_OWN,
		Permission.KITCHEN_USE,
		Permission.CUSTOMERS_WRITE,
	],
	// Kitchen and floor staff: see the menu and work the kitchen screen, nothing more.
	[MemberRole.STAFF]: [Permission.PRODUCTS_READ, Permission.KITCHEN_USE],
};

/** OWNER is never narrowed by a custom list: a shop must not be able to lock out its owner. */
export const resolvePermissions = (
	role: MemberRole,
	custom: readonly Permission[] | null | undefined
): readonly Permission[] => {
	if (role === MemberRole.OWNER) return ALL;
	return custom ?? ROLE_PERMISSIONS[role];
};

/** Never granted by a custom list: paying for the shop stays with its owner. */
export const OWNER_ONLY: readonly Permission[] = [Permission.SUBSCRIPTION_MANAGE];

/** Permissions that are useless without another; granting one grants what it needs. */
const IMPLIES: Partial<Record<Permission, Permission[]>> = {
	[Permission.PRODUCTS_WRITE]: [Permission.PRODUCTS_READ],
	[Permission.INVENTORY_WRITE]: [Permission.PRODUCTS_READ],
	[Permission.POS_USE]: [Permission.PRODUCTS_READ, Permission.ORDERS_READ_OWN],
	[Permission.ORDERS_READ_ALL]: [Permission.ORDERS_READ_OWN],
	[Permission.ORDERS_REFUND]: [Permission.ORDERS_READ_OWN],
	[Permission.ORDERS_CANCEL]: [Permission.ORDERS_READ_OWN],
	[Permission.ORDERS_DISCOUNT]: [Permission.POS_USE],
};

/** A custom list, closed over what each permission needs, in declaration order. */
export const normalizePermissions = (list: readonly Permission[]): Permission[] => {
	const out = new Set<Permission>();
	const add = (p: Permission) => {
		if (out.has(p)) return;
		out.add(p);
		for (const needed of IMPLIES[p] ?? []) add(needed);
	};
	for (const p of list) add(p);
	return ALL.filter((p) => out.has(p));
};
