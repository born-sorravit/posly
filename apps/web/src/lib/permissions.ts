/**
 * Which permission each screen needs — one table for the route gate, the nav and the
 * read-only states, so they cannot disagree. It mirrors what the API enforces on the
 * screen's main endpoint; the API still refuses on its own, this only makes sure nobody
 * fills in a form the server was always going to reject.
 */
export type PermissionKey =
	| "business:manage"
	| "branches:manage"
	| "members:manage"
	| "subscription:manage"
	| "settings:manage"
	| "products:read"
	| "products:write"
	| "inventory:write"
	| "pos:use"
	| "orders:read-own"
	| "orders:read-all"
	| "orders:refund"
	| "orders:cancel"
	| "orders:discount"
	| "kitchen:use"
	| "reports:read"
	| "expenses:write"
	| "customers:write";

interface RouteRule {
	/** Longest-prefix wins, so `/products/new` is checked before `/products`. */
	prefix: string;
	/** Exact match only (for `/products/new` vs `/products/<id>`). */
	exact?: boolean;
	permission: PermissionKey;
}

const RULES: RouteRule[] = ([
	{ prefix: "/pos", permission: "pos:use" },
	{ prefix: "/orders", permission: "orders:read-own" },
	{ prefix: "/products/new", exact: true, permission: "products:write" },
	{ prefix: "/products", permission: "products:read" },
	{ prefix: "/categories", permission: "products:write" },
	{ prefix: "/modifiers", permission: "products:write" },
	{ prefix: "/inventory/history", permission: "inventory:write" },
	{ prefix: "/inventory", permission: "inventory:write" },
	{ prefix: "/customers", permission: "customers:write" },
	{ prefix: "/kitchen", permission: "kitchen:use" },
	{ prefix: "/reports", permission: "reports:read" },
	{ prefix: "/expenses", permission: "expenses:write" },
	{ prefix: "/employees", permission: "members:manage" },
	{ prefix: "/settings", permission: "settings:manage" },
] satisfies RouteRule[]).sort((a, b) => b.prefix.length - a.prefix.length);

/** The permission a path needs, or null when anyone in the shop may open it. */
export const permissionForPath = (pathname: string): PermissionKey | null => {
	for (const rule of RULES) {
		const matches = rule.exact
			? pathname === rule.prefix
			: pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`);
		if (matches) return rule.permission;
	}
	return null;
};

/**
 * What a permission needs to be any use — the same table the API applies when it saves a
 * custom list, so the editor shows exactly what will be stored.
 */
export const PERMISSION_NEEDS: Partial<Record<PermissionKey, PermissionKey[]>> = {
	"products:write": ["products:read"],
	"inventory:write": ["products:read"],
	"pos:use": ["products:read", "orders:read-own"],
	"orders:read-all": ["orders:read-own"],
	"orders:refund": ["orders:read-own"],
	"orders:cancel": ["orders:read-own"],
	"orders:discount": ["pos:use"],
};

/** Turning one on also turns on what it needs. */
export const withNeeds = (list: Iterable<PermissionKey>): Set<PermissionKey> => {
	const out = new Set<PermissionKey>();
	const add = (p: PermissionKey) => {
		if (out.has(p)) return;
		out.add(p);
		for (const needed of PERMISSION_NEEDS[p] ?? []) add(needed);
	};
	for (const p of list) add(p);
	return out;
};

/** Turning one off also turns off everything that needs it. */
export const withoutDependents = (list: Iterable<PermissionKey>, removed: PermissionKey): Set<PermissionKey> => {
	const out = new Set(list);
	const drop = (p: PermissionKey) => {
		if (!out.delete(p)) return;
		for (const [other, needs] of Object.entries(PERMISSION_NEEDS) as [PermissionKey, PermissionKey[]][]) {
			if (needs.includes(p)) drop(other);
		}
	};
	drop(removed);
	return out;
};
