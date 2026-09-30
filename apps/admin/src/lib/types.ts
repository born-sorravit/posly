/**
 * Response shapes of the API's `/admin/*` routes, kept in step by hand with
 * apps/api/src/modules/admin/dto/admin.dto.ts. Money is satang.
 */

export interface CacheStats {
	provider: "redis" | "memory";
	keys: { total: number; byKind: Record<string, number>; truncated: boolean };
	server: {
		version: string | null;
		usedMemoryMb: number | null;
		maxMemoryMb: number | null;
		hits: number | null;
		misses: number | null;
		evictedKeys: number | null;
		uptimeSeconds: number | null;
	} | null;
}

export interface DailyPoint {
	date: string;
	orders: number;
	gmv: number;
	signups: number;
	newBusinesses: number;
}

export interface AdminOverviewResponse {
	days: number;
	totals: {
		businesses: number;
		newBusinesses: number;
		users: number;
		newUsers: number;
		ordersAllTime: number;
		ordersToday: number;
		gmvToday: number;
		ordersPeriod: number;
		gmvPeriod: number;
		refundsPeriod: number;
		refundedAmountPeriod: number;
		cancelledPeriod: number;
		activeShopsPeriod: number;
	};
	subscriptions: { plan: string; status: string; count: number }[];
	series: DailyPoint[];
	topBusinesses: { id: string; name: string; orders: number; gmv: number }[];
}

export interface AdminBusinessRow {
	id: string;
	name: string;
	businessType: string;
	ownerEmail: string | null;
	plan: string | null;
	subscriptionStatus: string | null;
	members: number;
	branches: number;
	orders30d: number;
	gmv30d: number;
	lastOrderAt: string | null;
	onboardedAt: string | null;
	createdAt: string;
	isDemo: boolean;
}

export interface AdminBusinessDetail {
	business: {
		id: string;
		name: string;
		businessType: string;
		phone: string | null;
		address: string | null;
		taxId: string | null;
		currency: string;
		timezone: string;
		onboardedAt: string | null;
		createdAt: string;
		isDemo: boolean;
	};
	subscription: {
		plan: string;
		planName: string | null;
		status: string;
		startDate: string;
		endDate: string | null;
		cancelAtPeriodEnd: boolean;
		hasStripe: boolean;
	} | null;
	stats: {
		ordersAllTime: number;
		gmvAllTime: number;
		orders30d: number;
		gmv30d: number;
		products: number;
		customers: number;
	};
	members: {
		id: string;
		displayName: string;
		email: string | null;
		role: string;
		status: string;
		hasAccount: boolean;
		createdAt: string;
	}[];
	branches: { id: string; name: string; isDefault: boolean; isActive: boolean }[];
	series: { date: string; orders: number; gmv: number }[];
	recentOrders: AdminOrderRow[];
	recentActivity: AdminAuditRow[];
	/** What platform admins changed on this shop, newest first. */
	adminActions: AdminActionRow[];
}

export interface AdminUserRow {
	id: string;
	email: string;
	name: string;
	provider: string;
	isVerified: boolean;
	isPlatformAdmin: boolean;
	isDemo: boolean;
	shops: number;
	lastSeenAt: string | null;
	createdAt: string;
}

export interface AdminSubscriptionRow {
	id: string;
	businessId: string;
	businessName: string;
	plan: string;
	planName: string | null;
	monthlyPrice: number;
	status: string;
	startDate: string;
	endDate: string | null;
	cancelAtPeriodEnd: boolean;
	hasStripe: boolean;
}

export interface AdminSubscriptionSummary {
	byStatus: Record<string, number>;
	/** Sum of monthly prices of ACTIVE paid plans, in satang. */
	mrr: number;
}

export interface AdminAuditRow {
	id: string;
	businessId: string;
	businessName: string;
	actorName: string;
	action: string;
	entity: string;
	entityId: string;
	payload: Record<string, unknown>;
	createdAt: string;
}

export interface AdminOrderRow {
	id: string;
	businessId: string;
	businessName: string;
	number: number;
	status: string;
	serviceType: string | null;
	employeeName: string;
	total: number;
	createdAt: string;
}

export interface AdminSystemResponse {
	checkedAt: string;
	api: {
		env: string;
		node: string;
		uptimeSeconds: number;
		memory: { rssMb: number; heapUsedMb: number; heapTotalMb: number };
		timezone: string;
	};
	database: {
		up: boolean;
		latencyMs: number | null;
		sizeMb: number | null;
		connections: number | null;
		migrations: { applied: number; last: string | null; pending: boolean | null };
		tables: { name: string; rows: number }[];
	};
	cache: { provider: "redis" | "memory"; up: boolean; latencyMs: number | null };
	cacheStats: CacheStats | null;
	integrations: {
		stripe: boolean;
		stripeWebhook: boolean;
		mail: boolean;
		storage: boolean;
		googleSignIn: boolean;
		demo: boolean;
	};
}

export interface AdminUserDetail {
	user: {
		id: string;
		email: string;
		name: string;
		avatarUrl: string | null;
		provider: string;
		isVerified: boolean;
		isPlatformAdmin: boolean;
		isDemo: boolean;
		locale: string;
		createdAt: string;
		lastSeenAt: string | null;
	};
	memberships: {
		businessId: string;
		businessName: string;
		role: string;
		status: string;
		plan: string | null;
		joinedAt: string;
	}[];
	/** Refresh tokens not revoked and not expired: one per signed-in device. */
	sessions: {
		id: string;
		createdAt: string;
		expiresAt: string;
		userAgent: string | null;
	}[];
	actions: AdminActionRow[];
}

export interface AdminActionRow {
	id: string;
	adminEmail: string;
	action: string;
	targetType: string;
	targetId: string;
	targetName: string | null;
	payload: Record<string, unknown>;
	createdAt: string;
}
