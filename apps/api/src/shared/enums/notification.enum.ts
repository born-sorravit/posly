/** What happened. The text is written by the client from `kind` + `data`, in its language. */
export enum NotificationKind {
	LOW_STOCK = "LOW_STOCK",
	OUT_OF_STOCK = "OUT_OF_STOCK",
	REFUND = "REFUND",
	CANCELLED = "CANCELLED",
	DAILY_SUMMARY = "DAILY_SUMMARY",
	ORDER_QUOTA = "ORDER_QUOTA",
	/** A plan renewal was declined; the shop is on Free limits until the card is fixed. */
	PAYMENT_FAILED = "PAYMENT_FAILED",
	/** A message from Posly to shops, sent from the admin monitor: `{ title, body }`. */
	ANNOUNCEMENT = "ANNOUNCEMENT",
	/** A guest sent a round from a table's QR: `{ table, items }`, entityId = the tab. */
	TABLE_REQUEST = "TABLE_REQUEST",
}
