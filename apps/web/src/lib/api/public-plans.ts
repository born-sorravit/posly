import "server-only";
import type { PlanDto } from "@/lib/api/posly";
import { env } from "@/lib/env";

/**
 * The price list for server-rendered pages (the landing page), straight from the API that
 * enforces it — so the public prices can never disagree with what a shop is charged.
 *
 * Cached for five minutes. Returns null when the API cannot be reached, and the page drops
 * its pricing cards rather than showing stale or invented prices.
 */
export async function getPublicPlans(): Promise<PlanDto[] | null> {
	try {
		const response = await fetch(`${env.apiBaseUrl}/plans`, { next: { revalidate: 300 } });
		if (!response.ok) return null;
		const payload = (await response.json()) as { data?: PlanDto[] };
		return payload.data ?? null;
	} catch {
		return null;
	}
}
