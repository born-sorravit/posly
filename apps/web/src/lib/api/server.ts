import "server-only";

import type { BusinessSummaryDto } from "@/lib/api/posly";
import { readTokens } from "@/lib/auth/session";
import { env } from "@/lib/env";

/**
 * Server components reading the API with the session cookie's token. Read-only: a server
 * component cannot write rotated cookies, and the proxy has already refreshed a stale token
 * before the page renders.
 */
export async function fetchMyBusinesses(): Promise<BusinessSummaryDto[] | null> {
	const { accessToken } = await readTokens();
	if (!accessToken) return null;
	const response = await fetch(`${env.apiBaseUrl}/businesses`, {
		headers: { Authorization: `Bearer ${accessToken}` },
		cache: "no-store",
	}).catch(() => null);
	if (!response?.ok) return null;
	const payload = (await response.json()) as { data: BusinessSummaryDto[] };
	return payload.data;
}
