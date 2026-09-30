/**
 * Moving (weighted) average cost after receiving stock: what is on the shelf keeps the cost
 * it came in at, and the new units bring theirs.
 *
 *   (onHand × currentCost + received × paidPerUnit) / (onHand + received)
 *
 * With nothing usable on hand — none, a negative count (sold past zero), or no cost known —
 * the price just paid is the only honest figure, so it becomes the cost.
 * Costs are per unit and may be fractional; callers round to what they store.
 */
export const averageCost = (
	onHand: number,
	currentCost: number | null,
	received: number,
	paidPerUnit: number
): number => {
	if (received <= 0) return currentCost ?? paidPerUnit;
	if (onHand <= 0 || currentCost === null) return paidPerUnit;
	return (onHand * currentCost + received * paidPerUnit) / (onHand + received);
};
