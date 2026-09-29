/** What the audit log records. Money-reversing actions are always logged (plan §14). */
export enum AuditAction {
	ORDER_REFUNDED = "ORDER_REFUNDED",
	ORDER_CANCELLED = "ORDER_CANCELLED",
	/** A manual stock change: goods received, written off, or a shelf count. */
	STOCK_ADJUSTED = "STOCK_ADJUSTED",
}
