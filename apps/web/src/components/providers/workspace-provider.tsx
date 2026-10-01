"use client";

import { api, type BusinessDetailDto, type BusinessSummaryDto, type RecipeOwner } from "@/lib/api/posly";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { Branch, Business, FeatureKey } from "@posly/types/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

export const queryKeys = {
	businesses: ["businesses"] as const,
	business: (id: string) => ["business", id] as const,
	branches: (id: string) => ["business", id, "branches"] as const,
	categories: (id: string) => ["business", id, "categories"] as const,
	products: (id: string) => ["business", id, "products"] as const,
	product: (id: string, productId: string) => ["business", id, "products", productId] as const,
	orders: (id: string, filters: object) => ["business", id, "orders", filters] as const,
	order: (id: string, orderId: string) => ["business", id, "order", orderId] as const,
	dashboard: (id: string, query: string | Record<string, string | undefined>) =>
		["business", id, "dashboard", query] as const,
	// Under "dashboard" so everything that invalidates the dashboard (a sale, an expense) also
	// refreshes the Advanced report.
	insights: (id: string, query: Record<string, string | undefined>) =>
		["business", id, "dashboard", "insights", query] as const,
	members: (id: string) => ["business", id, "members"] as const,
	stockAdjustments: (id: string, filters: object) => ["business", id, "stock-adjustments", filters] as const,
	expenses: (id: string, filters: object) => ["business", id, "expenses", filters] as const,
	expenseSummary: (id: string, filters: object) => ["business", id, "expenses", "summary", filters] as const,
	customers: (id: string, query: object) => ["business", id, "customers", query] as const,
	modifierGroups: (id: string) => ["business", id, "modifier-groups"] as const,
	ingredients: (id: string) => ["business", id, "ingredients"] as const,
	recipe: (id: string, owner: RecipeOwner) =>
		["business", id, "recipe", "productId" in owner ? owner.productId : owner.optionId] as const,
	tables: (id: string) => ["business", id, "tables"] as const,
	tableBoard: (id: string) => ["business", id, "tables", "board"] as const,
	tab: (id: string, sessionId: string) => ["business", id, "tables", "tab", sessionId] as const,
	notifications: (id: string) => ["business", id, "notifications"] as const,
	notificationPreferences: (id: string) => ["business", id, "notification-preferences"] as const,
};

interface WorkspaceValue {
	business: Business;
	detail: BusinessDetailDto;
	branch: Branch | null;
	businesses: BusinessSummaryDto[];
	can: (permission: string) => boolean;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

const toBusiness = (detail: BusinessDetailDto, branches: Branch[]): Business => ({
	id: detail.id,
	name: detail.name,
	businessType: detail.businessType,
	logoUrl: detail.logoUrl,
	currency: detail.currency,
	role: detail.role,
	phone: detail.phone,
	address: detail.address,
	taxId: detail.taxId,
	promptPayId: detail.promptPayId,
	vatBasisPoints: detail.vatBasisPoints,
	pricesIncludeVat: detail.pricesIncludeVat,
	receiptFooter: detail.receiptFooter,
	receiptShowLogo: detail.receiptShowLogo,
	receiptShowTaxId: detail.receiptShowTaxId,
	branches,
});

/**
 * Which shop this device is working in, resolved against what the API says the user may
 * open.
 *
 * The persisted id is a preference, not a fact: a shared tablet that switches accounts would
 * otherwise keep the previous person's shop id and every call would 404. So it is checked
 * against `GET /businesses` and replaced when it is not in the list.
 */
export function WorkspaceProvider({
	initialBusinesses,
	children,
	fallback,
	errorFallback,
}: {
	initialBusinesses: BusinessSummaryDto[];
	children: ReactNode;
	fallback: ReactNode;
	/** Shown when the shop cannot be loaded at all — never an endless skeleton. */
	errorFallback: (retry: () => void) => ReactNode;
}) {
	const queryClient = useQueryClient();
	// Resolve against the persisted choice only once it has been read from storage;
	// otherwise the first render would pick shop #1 and overwrite the saved one.
	// `persist` does not exist during the server render (no storage there), hence the `?.`.
	const [hydrated, setHydrated] = useState(() => useWorkspaceStore.persist?.hasHydrated() ?? false);
	useEffect(() => {
		if (hydrated) return;
		void Promise.resolve(useWorkspaceStore.persist?.rehydrate()).then(() => setHydrated(true));
	}, [hydrated]);
	const storedId = useWorkspaceStore((s) => s.businessId);
	const branchId = useWorkspaceStore((s) => s.branchId);
	const setBusiness = useWorkspaceStore((s) => s.setBusiness);

	const businesses = useQuery({
		queryKey: queryKeys.businesses,
		queryFn: ({ signal }) => api.businesses.list(signal),
		initialData: initialBusinesses.length > 0 ? initialBusinesses : undefined,
	});

	const list = useMemo(() => businesses.data ?? [], [businesses.data]);
	const businessId = !hydrated
		? null
		: list.some((b) => b.id === storedId)
			? storedId
			: (list[0]?.id ?? null);

	useEffect(() => {
		if (hydrated && businessId && businessId !== storedId) {
			// A stale id from another account: drop anything cached under it.
			if (storedId) queryClient.removeQueries({ queryKey: ["business", storedId] });
			setBusiness(businessId);
		}
	}, [hydrated, businessId, storedId, setBusiness, queryClient]);

	const detail = useQuery({
		queryKey: queryKeys.business(businessId ?? "none"),
		queryFn: ({ signal }) => api.businesses.get(businessId as string, signal),
		enabled: Boolean(businessId),
	});
	const branches = useQuery({
		queryKey: queryKeys.branches(businessId ?? "none"),
		queryFn: ({ signal }) => api.businesses.branches(businessId as string, signal),
		enabled: Boolean(businessId),
	});

	const value = useMemo<WorkspaceValue | null>(() => {
		if (!detail.data || !branches.data) return null;
		const business = toBusiness(detail.data, branches.data);
		const permissions = new Set(detail.data.permissions);
		return {
			business,
			detail: detail.data,
			branch: business.branches.find((b) => b.id === branchId) ?? null,
			businesses: list,
			can: (p) => permissions.has(p),
		};
	}, [detail.data, branches.data, branchId, list]);

	if (!value) {
		const failed = businesses.isError || detail.isError || branches.isError;
		if (failed) {
			return (
				<>
					{errorFallback(() => {
						void businesses.refetch();
						void detail.refetch();
						void branches.refetch();
					})}
				</>
			);
		}
		return <>{fallback}</>;
	}
	return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
	const value = useContext(WorkspaceContext);
	if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider");
	return value;
}

/**
 * Entitlements (plan §26): `hasFeature("INVENTORY")`, never `plan === "PRO"`. Read from the
 * API's resolved subscription, so a lapsed plan loses its features here the moment the API
 * says so — the UI never decides from a plan code.
 */
export function useFeature(feature: FeatureKey): boolean {
	return useWorkspace().detail.subscription.features.includes(feature);
}

/** The shop's plan, limits and usage this month. */
export function useSubscription() {
	return useWorkspace().detail.subscription;
}
