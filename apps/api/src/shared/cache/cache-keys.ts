/**
 * Cache keys shared between the module that reads a value and the modules that change it,
 * so a writer can invalidate without importing the reader.
 */
export const CacheKeys = {
	/** Version counter for a shop's dashboard: bumped by anything that changes its figures. */
	dashboardVersion: (businessId: string) => `dashboard:${businessId}`,
	/** A shop's subscription row, as entitlements read it. */
	subscription: (businessId: string) => `subscription:${businessId}`,
} as const;
