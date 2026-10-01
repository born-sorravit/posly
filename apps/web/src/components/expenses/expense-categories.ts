import type { ExpenseCategory } from "@/lib/api/posly";
import { Ellipsis, HandCoins, House, type LucideIcon, ShoppingBasket, Wrench, Zap } from "lucide-react";

/** Expense categories in display order, each with its icon and one hue used everywhere. */
export const EXPENSE_CATEGORIES: {
	value: ExpenseCategory;
	icon: LucideIcon;
	ink: string;
	dot: string;
	/** The same hue for chart fills, where a class name will not do. */
	color: string;
}[] = [
	{ value: "INGREDIENTS", icon: ShoppingBasket, ink: "text-[#16a34a] bg-[#16a34a]/12", dot: "bg-[#16a34a]", color: "#16a34a" },
	{ value: "UTILITIES", icon: Zap, ink: "text-[#d97706] bg-[#d97706]/12", dot: "bg-[#d97706]", color: "#d97706" },
	{ value: "SALARY", icon: HandCoins, ink: "text-[#635bff] bg-[#635bff]/12", dot: "bg-[#635bff]", color: "#635bff" },
	{ value: "RENT", icon: House, ink: "text-[#0891b2] bg-[#0891b2]/12", dot: "bg-[#0891b2]", color: "#0891b2" },
	{ value: "EQUIPMENT", icon: Wrench, ink: "text-[#db2777] bg-[#db2777]/12", dot: "bg-[#db2777]", color: "#db2777" },
	{ value: "OTHER", icon: Ellipsis, ink: "text-muted-foreground bg-muted", dot: "bg-muted-foreground/50", color: "#94a3b8" },
];
export const CATEGORY = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.value, c])) as Record<
	ExpenseCategory,
	(typeof EXPENSE_CATEGORIES)[number]
>;
