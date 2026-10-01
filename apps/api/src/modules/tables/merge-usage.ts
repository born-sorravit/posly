import { roundQuantity } from "@/shared/utils/quantity.util";

/**
 * What a tab has taken from ingredient stock across its rounds, so a void puts back exactly
 * that. Null when no round took anything — the same meaning as on a single sale.
 */
export const mergeUsage = (
	...usages: (Record<string, number> | null)[]
): Record<string, number> | null => {
	const total: Record<string, number> = {};
	for (const usage of usages) {
		for (const [id, amount] of Object.entries(usage ?? {})) {
			total[id] = roundQuantity((total[id] ?? 0) + amount);
		}
	}
	return Object.keys(total).length ? total : null;
};
