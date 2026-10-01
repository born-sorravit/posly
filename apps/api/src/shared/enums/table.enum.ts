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
	/** The guest says they paid by PromptPay from their phone; staff check the bank app. */
	PAID = "PAID",
}

/** Which call stays on the table when another comes in: the one nearest to settling up. */
export const CALL_RANK: Record<TableCallKind, number> = {
	[TableCallKind.WAITER]: 0,
	[TableCallKind.BILL]: 1,
	[TableCallKind.PAID]: 2,
};

/** What guests send from the QR on the table, before staff accept it into the tab. */
export enum TableRequestStatus {
	PENDING = "PENDING",
	ACCEPTED = "ACCEPTED",
	REJECTED = "REJECTED",
}
