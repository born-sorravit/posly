/** A table's tab: open while guests are seated, then paid (CLOSED) or voided (CANCELLED). */
export enum TableSessionStatus {
	OPEN = "OPEN",
	CLOSED = "CLOSED",
	CANCELLED = "CANCELLED",
}

/** What a guest at the table is asking for from its QR, besides food. */
export enum TableCallKind {
	WAITER = "WAITER",
	BILL = "BILL",
}

/** What guests send from the QR on the table, before staff accept it into the tab. */
export enum TableRequestStatus {
	PENDING = "PENDING",
	ACCEPTED = "ACCEPTED",
	REJECTED = "REJECTED",
}
