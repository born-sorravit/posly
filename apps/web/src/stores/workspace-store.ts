"use client";

import { WORKSPACE_COOKIE } from "@/lib/auth/cookie-names";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface WorkspaceState {
	/** The business the user is acting in. Sent as the `:businessId` of every API call. */
	businessId: string | null;
	/** Null = all branches (dashboard); the POS always resolves to one. */
	branchId: string | null;
	sidebarCollapsed: boolean;
	setBusiness: (businessId: string, branchId?: string | null) => void;
	setBranch: (branchId: string | null) => void;
	toggleSidebar: () => void;
}

/** Mirrors the chosen shop into a cookie, so the server can render it on the next load. */
const rememberShop = (businessId: string | null) => {
	if (typeof document === "undefined") return;
	document.cookie = businessId
		? `${WORKSPACE_COOKIE}=${encodeURIComponent(businessId)}; path=/; max-age=31536000; samesite=lax`
		: `${WORKSPACE_COOKIE}=; path=/; max-age=0; samesite=lax`;
};

/**
 * Per-device UI state: which shop and branch this device is working in, and chrome
 * preferences. Persisted because a tablet at the counter should reopen on the same shop.
 *
 * Only ids live here. What the user may do in that business comes from the API on every
 * request; this store is never the source of truth for access.
 */
export const useWorkspaceStore = create<WorkspaceState>()(
	persist(
		(set) => ({
			businessId: null,
			branchId: null,
			sidebarCollapsed: false,
			setBusiness: (businessId, branchId = null) => {
				rememberShop(businessId);
				set({ businessId, branchId });
			},
			setBranch: (branchId) => set({ branchId }),
			toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
		}),
		{
			name: "posly-workspace",
			storage: createJSONStorage(() => localStorage),
			// Read after mount: rendering from localStorage on the server would mismatch.
			skipHydration: true,
			// A device that chose its shop before the cookie existed gets it now.
			onRehydrateStorage: () => (state) => rememberShop(state?.businessId ?? null),
		}
	)
);
