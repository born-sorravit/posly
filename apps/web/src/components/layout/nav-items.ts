import { permissionForPath } from "@/lib/permissions";
import {
	BarChart3,
	Boxes,
	ChefHat,
	LayoutGrid,
	type LucideIcon,
	Package,
	ReceiptText,
	Settings,
	ShoppingCart,
	SlidersHorizontal,
	Tags,
	UserRound,
	UsersRound,
	UtensilsCrossed,
	Wallet,
} from "lucide-react";

export type NavKey =
	| "overview"
	| "pos"
	| "tables"
	| "orders"
	| "kitchen"
	| "products"
	| "categories"
	| "modifiers"
	| "inventory"
	| "customers"
	| "reports"
	| "expenses"
	| "employees"
	| "settings";

export interface NavItem {
	key: NavKey;
	href: string;
	icon: LucideIcon;
}

/**
 * What each page needs, mirroring the API's permission on its main endpoint. Hiding a link
 * is a courtesy — the API refuses regardless — but a cashier should not be shown a menu of
 * pages that answer 403.
 */
export const NAV_PERMISSION: Record<NavKey, string> = {
	// The dashboard is the owner's landing page; staff are sent on to the POS instead.
	overview: "reports:read",
	...(Object.fromEntries(
		(
			[
				["pos", "/pos"],
				["tables", "/tables"],
				["kitchen", "/kitchen"],
				["orders", "/orders"],
				["products", "/products"],
				["categories", "/categories"],
				["modifiers", "/modifiers"],
				["inventory", "/inventory"],
				["customers", "/customers"],
				["reports", "/reports"],
				["expenses", "/expenses"],
				["employees", "/employees"],
				["settings", "/settings"],
			] as const
		).map(([key, path]) => [key, permissionForPath(path) as string])
	) as Record<Exclude<NavKey, "overview">, string>),
};

export const visibleSections = (can: (permission: string) => boolean): NavSection[] =>
	NAV_SECTIONS.map((section) => ({
		...section,
		items: section.items.filter((item) => can(NAV_PERMISSION[item.key])),
	})).filter((section) => section.items.length > 0);

export interface NavSection {
	/** Untitled sections render without a heading. */
	key: "main" | "catalog" | "people" | "system";
	items: NavItem[];
}

/**
 * The sidebar, in the plan's order (§7). One definition feeds the desktop rail, the
 * collapsed rail, the tablet sheet and the command menu, so they cannot drift apart.
 */
export const NAV_SECTIONS: NavSection[] = [
	{
		key: "main",
		items: [
			{ key: "overview", href: "/dashboard", icon: LayoutGrid },
			{ key: "pos", href: "/pos", icon: ShoppingCart },
			{ key: "tables", href: "/tables", icon: UtensilsCrossed },
			{ key: "kitchen", href: "/kitchen", icon: ChefHat },
			{ key: "orders", href: "/orders", icon: ReceiptText },
		],
	},
	{
		key: "catalog",
		items: [
			{ key: "products", href: "/products", icon: Package },
			{ key: "categories", href: "/categories", icon: Tags },
			{ key: "modifiers", href: "/modifiers", icon: SlidersHorizontal },
			{ key: "inventory", href: "/inventory", icon: Boxes },
		],
	},
	{
		key: "people",
		items: [
			{ key: "customers", href: "/customers", icon: UserRound },
			{ key: "reports", href: "/reports", icon: BarChart3 },
			{ key: "expenses", href: "/expenses", icon: Wallet },
			{ key: "employees", href: "/employees", icon: UsersRound },
		],
	},
	{
		key: "system",
		items: [{ key: "settings", href: "/settings", icon: Settings }],
	},
];

export const isActivePath = (pathname: string, href: string): boolean =>
	pathname === href || pathname.startsWith(`${href}/`);
