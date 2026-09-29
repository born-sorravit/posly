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

/** Most senior first: how a shop's people are listed. */
export const ROLE_RANK: Record<MemberRole, number> = {
	[MemberRole.OWNER]: 0,
	[MemberRole.MANAGER]: 1,
	[MemberRole.CASHIER]: 2,
	[MemberRole.STAFF]: 3,
};

/**
 * Sorts by role, most senior first. `Array.prototype.sort` is stable, so rows fetched oldest
 * first stay in the order they joined within each role.
 */
export const bySeniority = <T extends { role: MemberRole }>(a: T, b: T): number =>
	ROLE_RANK[a.role] - ROLE_RANK[b.role];
