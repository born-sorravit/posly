/** Plan codes. The rows live in `subscription_plan`; this enum is only their names. */
export enum PlanCode {
	FREE = "FREE",
	STARTER = "STARTER",
	PRO = "PRO",
	BUSINESS = "BUSINESS",
}

export enum SubscriptionStatus {
	TRIALING = "TRIALING",
	ACTIVE = "ACTIVE",
	/** Payment failed; the shop falls back to Free until it is settled. */
	PAST_DUE = "PAST_DUE",
	CANCELLED = "CANCELLED",
}

/**
 * What a plan unlocks (plan §26). Code asks `hasFeature(Feature.INVENTORY)`, never
 * `plan === "PRO"`, so moving a feature between plans is a row change, not a deploy.
 */
export enum Feature {
	INVENTORY = "INVENTORY",
	CUSTOMERS = "CUSTOMERS",
	EXPENSES = "EXPENSES",
	ADVANCED_REPORT = "ADVANCED_REPORT",
	MULTI_BRANCH = "MULTI_BRANCH",
	LINE_NOTIFICATION = "LINE_NOTIFICATION",
	KITCHEN_DISPLAY = "KITCHEN_DISPLAY",
	ADVANCED_PERMISSION = "ADVANCED_PERMISSION",
	/** Tables and their tabs: open a table, add rounds, check out once. */
	TABLES = "TABLES",
	/** Guests order from the QR on their table (needs TABLES). */
	QR_ORDERING = "QR_ORDERING",
}
