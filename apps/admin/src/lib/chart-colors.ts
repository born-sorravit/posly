/**
 * One colour per measure, the same on every page, so "signups" is teal wherever it is drawn
 * and two charts side by side never look like one chart twice. Money is always `success`
 * (DESIGN.md → กราฟ); the counts take the categorical slots in order.
 */
export const MEASURE_COLOR = {
	gmv: "var(--success)",
	mrr: "var(--success)",
	orders: "var(--chart-1)",
	signups: "var(--chart-2)",
	newBusinesses: "var(--chart-3)",
	activeBusinesses: "var(--chart-5)",
} as const;

/**
 * Plans are identities, so each has its own hue in a fixed order, cheapest to dearest. Free
 * is the unpaid baseline and stays neutral, which also keeps the paid plans the ones that
 * catch the eye. Validated for colour-blind separation in light and dark (dataviz check).
 */
export const PLAN_COLOR: Record<string, string> = {
	FREE: "var(--muted-foreground)",
	STARTER: "var(--chart-2)",
	PRO: "var(--chart-1)",
	BUSINESS: "var(--chart-3)",
};
