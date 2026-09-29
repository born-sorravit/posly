/**
 * A person's role **inside one business**, not globally.
 *
 * The same user can own one cafe and be a cashier at a friend's bakery, so the role lives on
 * `BusinessMember`, never on `User`.
 */
export enum MemberRole {
	OWNER = "OWNER",
	MANAGER = "MANAGER",
	CASHIER = "CASHIER",
	STAFF = "STAFF",
}
