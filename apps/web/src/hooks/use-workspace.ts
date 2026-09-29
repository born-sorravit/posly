"use client";

import { useWorkspace } from "@/components/providers/workspace-provider";

export { useFeature } from "@/components/providers/workspace-provider";

/** The business and branch in use — same shape the mock-backed version returned. */
export function useActiveBusiness() {
	const { business, branch, businesses, can, detail } = useWorkspace();
	return { business, branch, businesses, can, detail };
}
