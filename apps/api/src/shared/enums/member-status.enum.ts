export enum MemberStatus {
	/** Invited by email, has not accepted yet. */
	INVITED = "INVITED",
	ACTIVE = "ACTIVE",
	/** Removed from the business; kept for the audit trail of orders they took. */
	DISABLED = "DISABLED",
}
