"use client";

import type { ApiEnvelope, Paginated } from "@posly/types/api";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export class AdminApiError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
		this.name = "AdminApiError";
	}
}

type Query = Record<string, string | number | boolean | null | undefined>;

const buildPath = (path: string, query?: Query) => {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query ?? {})) {
		if (value === null || value === undefined || value === "") continue;
		params.set(key, String(value));
	}
	const search = params.toString();
	return `/api/backend/admin/${path}${search ? `?${search}` : ""}`;
};

/**
 * GET through our own `/api/backend` proxy, which adds the token. A 401 after the proxy's
 * own refresh means the session is gone, so the whole app goes back to sign-in.
 */
async function adminGet<T>(path: string, query?: Query): Promise<ApiEnvelope<T>> {
	const response = await fetch(buildPath(path, query), { cache: "no-store" });
	const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
	if (response.status === 401) {
		// A full load on purpose: the server layout must re-read the session cookies.
		// eslint-disable-next-line @next/next/no-location-assign-relative-destination
		window.location.assign("/login");
	}
	if (!response.ok || !payload) {
		throw new AdminApiError(payload?.message ?? response.statusText, response.status);
	}
	return payload;
}

/** One admin resource, polled while the tab is visible (react-query pauses in background). */
export function useAdmin<T>(path: string, query?: Query, refetchInterval = 60_000) {
	return useQuery({
		queryKey: ["admin", path, query],
		queryFn: async () => (await adminGet<T>(path, query)).data,
		refetchInterval,
		placeholderData: keepPreviousData,
	});
}

export function useAdminPage<T>(path: string, query?: Query, refetchInterval = 60_000) {
	return useQuery({
		queryKey: ["admin", path, query],
		queryFn: async (): Promise<Paginated<T>> => {
			const payload = await adminGet<T[]>(path, query);
			return {
				data: payload.data ?? [],
				meta: payload.meta ?? { total: 0, page: 1, last_page: 0, limit: 20 },
			};
		},
		refetchInterval,
		placeholderData: keepPreviousData,
	});
}

/**
 * An admin action (POST). On success every cached admin read is refetched, since an action
 * can change several pages at once (a shop's plan shows on overview, lists and detail).
 */
export function useAdminAction<TBody, TResult>(path: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (body: TBody): Promise<TResult> => {
			const response = await fetch(`/api/backend/admin/${path}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			const payload = (await response.json().catch(() => null)) as ApiEnvelope<TResult> | null;
			if (!response.ok || !payload) {
				throw new AdminApiError(payload?.message ?? response.statusText, response.status);
			}
			return payload.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
	});
}
