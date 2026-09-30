"use client";

import { useDemoFilter } from "@/components/common/demo-filter";
import { useAdmin } from "@/lib/admin-api";
import type { AdminAttentionResponse } from "@/lib/types";

/** The worklists, shared by the page and the nav badge (one query, polled every 5 minutes). */
export function useAttention() {
	const { includeDemo } = useDemoFilter();
	const query = useAdmin<AdminAttentionResponse>("attention", { includeDemo }, 5 * 60_000);
	const total = query.data ? Object.values(query.data).reduce((sum, rows) => sum + rows.length, 0) : 0;
	return { ...query, total };
}
