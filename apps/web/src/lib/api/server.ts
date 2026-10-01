import "server-only";

import type { BusinessDetailDto, BusinessSummaryDto, InitialWorkspace } from "@/lib/api/posly";
import { WORKSPACE_COOKIE } from "@/lib/auth/cookie-names";
import type { Branch } from "@posly/types/domain";
import { cookies } from "next/headers";
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

/**
 * The shop this device last chose (the workspace cookie) if the user still belongs to it,
 * otherwise their first. Null when it cannot be loaded; the client then fetches as before.
 */
export async function fetchInitialWorkspace(
	businesses: BusinessSummaryDto[]
): Promise<InitialWorkspace | null> {
	const { accessToken } = await readTokens();
	if (!accessToken || businesses.length === 0) return null;
	const preferred = (await cookies()).get(WORKSPACE_COOKIE)?.value;
	const businessId = businesses.some((b) => b.id === preferred) ? (preferred as string) : businesses[0].id;
	const get = async <T>(path: string): Promise<T | null> => {
		const response = await fetch(`${env.apiBaseUrl}${path}`, {
			headers: { Authorization: `Bearer ${accessToken}` },
			cache: "no-store",
		}).catch(() => null);
		if (!response?.ok) return null;
		return ((await response.json()) as { data: T }).data;
	};
	const [detail, branches] = await Promise.all([
		get<BusinessDetailDto>(`/businesses/${businessId}`),
		get<Branch[]>(`/businesses/${businessId}/branches`),
	]);
	if (!detail || !branches) return null;
	return { businessId, detail, branches, fetchedAt: Date.now() };
}
