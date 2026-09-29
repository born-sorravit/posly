import type { AuthUser } from "@posly/types/api";
import { backend } from "@/lib/api/backend";
import type { Satang } from "@posly/utils/money";
import type {
	Branch,
	ServiceType,
	BusinessType,
	Category,
	Employee,
	MemberRole,
	ModifierGroup,
	Order,
	OrderStatus,
	PaymentMethod,
	Product,
	ProductArt,
	FeatureKey,
} from "@posly/types/domain";

/**
 * Every endpoint the UI calls, typed against the backend DTOs. Business-scoped calls take
 * the id explicitly — never read from a global — so a query key and its URL cannot disagree
 * about which shop they are for.
 */

export interface BusinessSummaryDto {
	id: string;
	name: string;
	businessType: BusinessType;
	logoUrl: string | null;
	currency: "THB";
	role: MemberRole;
	onboardedAt: string | null;
}

export interface BusinessDetailDto extends BusinessSummaryDto {
	phone: string | null;
	address: string | null;
	taxId: string | null;
	promptPayId: string | null;
	timezone: string;
	vatBasisPoints: number;
	pricesIncludeVat: boolean;
	receiptFooter: string | null;
	receiptShowLogo: boolean;
	receiptShowTaxId: boolean;
	permissions: string[];
	subscription: SubscriptionDto;
}

/** What this shop may do right now, resolved by the API (plan §25: it is the source of truth). */
export interface SubscriptionDto {
	/** The plan in force — FREE while a paid plan has lapsed. */
	plan: PlanCode;
	planName: string;
	subscribedPlan: PlanCode;
	status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELLED";
	endDate: string | null;
	cancelAtPeriodEnd: boolean;
	/** Paid by card through Stripe: plan changes and the card go through billing. */
	billedOnline: boolean;
	/** Whether this server takes card payments at all (a Stripe key is configured). */
	onlinePayment: boolean;
	features: FeatureKey[];
	/** null is unlimited. `members` counts staff, not the owner. */
	limits: { orders: number | null; members: number | null; branches: number | null };
	usage: { ordersThisMonth: number; members: number; branches: number };
}

export type PlanCode = "FREE" | "STARTER" | "PRO" | "BUSINESS";

export interface PlanDto {
	code: PlanCode;
	name: string;
	monthlyPrice: Satang;
	orderLimit: number | null;
	memberLimit: number | null;
	branchLimit: number | null;
	features: FeatureKey[];
	/** `soon` = promised on the card but not shipped yet. */
	highlights: { label: string; soon: boolean }[];
}

export interface ProductDto extends Omit<Product, "art" | "modifierGroups"> {
	art: ProductArt;
	imagePath: string | null;
	modifierGroups: (ModifierGroup & { options: (ModifierGroup["options"][number] & { isDefault: boolean })[] })[];
}

export interface OrderDto extends Order {
	branchId: string;
	audit: { action: string; actorName: string; reason: string | null; createdAt: string }[];
}

export interface DashboardDto {
	range: string;
	from: string;
	to: string;
	metrics: {
		revenue: Satang;
		revenueChange: number | null;
		orders: number;
		ordersChange: number | null;
		averageOrder: Satang;
		averageOrderChange: number | null;
		/** Cost of the goods sold, from the cost snapshot taken at each sale. */
		cost: Satang;
		/** Sales minus cost of goods — what the dashboard shows. */
		grossProfit: Satang;
		grossProfitChange: number | null;
		/** Expenses recorded for the same days. */
		expenses: Satang;
		/** Gross profit minus expenses — for reports, where the period is long enough. */
		estimatedProfit: Satang;
		profitChange: number | null;
		/** The comparison period's figures — for "today", yesterday up to the same time. */
		previousRevenue: Satang;
		previousOrders: number;
		previousAverageOrder: Satang;
		previousGrossProfit: Satang;
		previousEstimatedProfit: Satang;
	};
	series: { label: string; date: string; revenue: Satang; orders: number }[];
	topProducts: { name: string; art: ProductArt; sold: number; revenue: Satang }[];
	lowSelling: { name: string; art: ProductArt; sold: number; revenue: Satang }[];
	paymentBreakdown: { method: PaymentMethod; amount: Satang; count: number }[];
	employees: { name: string; orders: number; revenue: Satang; refunds: Satang; discounts: Satang }[];
	lowStock: { id: string; name: string; stock: number; unit: string; tone: "danger" | "warning" }[];
}

export type SamplePreviewDto = {
	name: string;
	products: { name: string; price: Satang; art: ProductArt }[];
}[];

export type StockAdjustmentType = "IN" | "OUT" | "COUNT";

export interface StockAdjustmentDto {
	id: string;
	createdAt: string;
	productId: string;
	productName: string;
	productUnit: string;
	art: ProductDto["art"];
	productDeleted: boolean;
	type: StockAdjustmentType;
	/** As entered: units moved, or the counted total for COUNT. */
	quantity: number;
	before: number;
	after: number;
	change: number;
	note: string | null;
	actorName: string;
}

// A type alias, not an interface, so it satisfies the query-string index signature.
export type StockAdjustmentFilters = {
	productId?: string;
	type?: StockAdjustmentType;
	page?: number;
};

/** IN adds `quantity`, OUT removes it, COUNT sets the shelf to exactly `quantity`. */
export interface StockAdjustmentInput {
	type: StockAdjustmentType;
	quantity: number;
	note?: string;
}

export interface InviteLinkDto {
	member: Employee;
	/** One-time link; the API keeps only its hash, so it is shown once. */
	inviteUrl: string;
	expiresAt: string;
}

export interface InvitePreviewDto {
	businessName: string;
	role: MemberRole;
	invitedName: string;
	expiresAt: string;
}

export type ReportRange = "today" | "yesterday" | "7d" | "30d";

export interface CheckoutInput {
	clientOrderId: string;
	branchId?: string;
	items: { productId: string; quantity: number; modifierOptionIds: string[]; note?: string }[];
	discount: Satang;
	payment: { method: PaymentMethod; received?: Satang };
	customerId?: string;
	serviceType?: ServiceType;
	label?: string;
}

export interface ModifierGroupDto {
	id: string;
	name: string;
	selection: "SINGLE" | "MULTIPLE";
	required: boolean;
	options: { id: string; name: string; priceDelta: Satang; isDefault: boolean }[];
	defaultOptionId: string | null;
	/** Products using the group (list only). */
	productCount?: number;
}

export interface ModifierGroupInput {
	name: string;
	selection: "SINGLE" | "MULTIPLE";
	required: boolean;
	/** An option with an id keeps it (and any cart holding it); without one it is new. */
	options: { id?: string; name: string; priceDelta: Satang; isDefault?: boolean }[];
}

export type ExpenseCategory = "INGREDIENTS" | "UTILITIES" | "SALARY" | "RENT" | "EQUIPMENT" | "OTHER";

export interface ExpenseDto {
	id: string;
	category: ExpenseCategory;
	amount: Satang;
	note: string | null;
	/** The shop-local day, YYYY-MM-DD. */
	spentOn: string;
	recordedBy: string;
	createdAt: string;
}

export type ExpenseFilters = { from?: string; to?: string; category?: ExpenseCategory; page?: number };

export interface ExpenseInput {
	category: ExpenseCategory;
	amount: Satang;
	note?: string;
	spentOn: string;
}

export type KitchenStatus = "NEW" | "PREPARING" | "READY" | "SERVED";

/** One order on the kitchen screen: only its lines that cook. */
export interface KitchenTicketDto {
	id: string;
	number: string;
	status: KitchenStatus;
	createdAt: string;
	updatedAt: string;
	branchId: string;
	employeeName: string;
	customerName: string | null;
	serviceType: ServiceType | null;
	label: string | null;
	lines: { id: string; name: string; quantity: number; note: string | null; modifiers: string[]; preparedAt: string | null }[];
}

export interface KitchenBoardDto {
	open: KitchenTicketDto[];
	recent: KitchenTicketDto[];
}

/** Someone who can take over the till, for the lock screen. */
export interface RosterEntry {
	id: string;
	name: string;
	role: MemberRole;
	hasPin: boolean;
	isYou: boolean;
}

export type NotificationKind =
	| "LOW_STOCK"
	| "OUT_OF_STOCK"
	| "REFUND"
	| "CANCELLED"
	| "DAILY_SUMMARY"
	| "ORDER_QUOTA"
	| "PAYMENT_FAILED";

/** An event, as facts; the words are written here from `kind` + `data`. */
export interface NotificationDto {
	id: string;
	kind: NotificationKind;
	entityId: string | null;
	data: Record<string, string | number | boolean | null>;
	read: boolean;
	createdAt: string;
}

export interface NotificationPreferenceDto {
	kind: NotificationKind;
	enabled: boolean;
}

export interface NotificationListDto {
	items: NotificationDto[];
	unread: number;
}

export interface CustomerDto {
	id: string;
	name: string;
	phone: string | null;
	email: string | null;
	note: string | null;
	totalOrders: number;
	totalSpending: Satang;
	lastVisitAt: string | null;
	createdAt: string;
}

export interface CustomerInput {
	name: string;
	phone?: string | null;
	email?: string | null;
	note?: string | null;
}

export interface ProductInput {
	name: string;
	categoryId: string | null;
	price: Satang;
	cost: Satang | null;
	sku: string | null;
	barcode: string | null;
	imagePath?: string | null;
	art?: ProductArt;
	trackStock: boolean;
	stock: number | null;
	lowStockAt: number | null;
	unit?: string;
	isActive?: boolean;
	modifierGroupIds?: string[];
}

const b = (businessId: string) => `/businesses/${businessId}`;

export const api = {
	auth: {
		forgotPassword: (email: string) => backend.post<{ sent: true }>("/auth/forgot-password", { email }),
		resetPassword: (token: string, newPassword: string) =>
			backend.post<{ reset: true }>("/auth/reset-password", { token, newPassword }),
		updateProfile: (body: { name?: string }) => backend.patch<AuthUser>("/auth/me", body),
	},
	plans: {
		list: (signal?: AbortSignal) => backend.get<PlanDto[]>("/plans", undefined, signal),
	},
	businesses: {
		list: (signal?: AbortSignal) => backend.get<BusinessSummaryDto[]>("/businesses", undefined, signal),
		get: (id: string, signal?: AbortSignal) => backend.get<BusinessDetailDto>(b(id), undefined, signal),
		create: (input: {
			name: string;
			businessType: BusinessType;
			phone?: string;
			address?: string;
			taxId?: string;
		}) => backend.post<BusinessSummaryDto>("/businesses", input),
		update: (id: string, input: Partial<BusinessDetailDto> & { logoPath?: string | null }) =>
			backend.patch<BusinessDetailDto>(b(id), input),
		completeOnboarding: (id: string) => backend.post<BusinessDetailDto>(`${b(id)}/onboarding/complete`),
		branches: (id: string, signal?: AbortSignal) => backend.get<Branch[]>(`${b(id)}/branches`, undefined, signal),
	},
	catalog: {
		categories: (id: string, signal?: AbortSignal) =>
			backend.get<Category[]>(`${b(id)}/categories`, undefined, signal),
		createCategory: (id: string, input: { name: string; icon?: string }) =>
			backend.post<Category>(`${b(id)}/categories`, input),
		updateCategory: (
			id: string,
			categoryId: string,
			input: Partial<Pick<Category, "name" | "icon" | "isActive" | "sendToKitchen">>
		) =>
			backend.patch<Category>(`${b(id)}/categories/${categoryId}`, input),
		reorderCategories: (id: string, ids: string[]) => backend.put<Category[]>(`${b(id)}/categories/order`, { ids }),
		products: (id: string, signal?: AbortSignal) =>
			backend.get<ProductDto[]>(`${b(id)}/products`, undefined, signal),
		product: (id: string, productId: string, signal?: AbortSignal) =>
			backend.get<ProductDto>(`${b(id)}/products/${productId}`, undefined, signal),
		createProduct: (id: string, input: ProductInput) => backend.post<ProductDto>(`${b(id)}/products`, input),
		updateProduct: (id: string, productId: string, input: Partial<ProductInput>) =>
			backend.patch<ProductDto>(`${b(id)}/products/${productId}`, input),
		modifierGroups: (id: string, signal?: AbortSignal) =>
			backend.get<ModifierGroupDto[]>(`${b(id)}/modifier-groups`, undefined, signal),
		createModifierGroup: (id: string, input: ModifierGroupInput) =>
			backend.post<ModifierGroupDto>(`${b(id)}/modifier-groups`, input),
		updateModifierGroup: (id: string, groupId: string, input: ModifierGroupInput) =>
			backend.put<ModifierGroupDto>(`${b(id)}/modifier-groups/${groupId}`, input),
		deleteModifierGroup: (id: string, groupId: string) => backend.delete(`${b(id)}/modifier-groups/${groupId}`),
		adjustStock: (id: string, productId: string, input: StockAdjustmentInput) =>
			backend.post<ProductDto>(`${b(id)}/products/${productId}/stock-adjustments`, input),
		stockAdjustments: (id: string, query: StockAdjustmentFilters & { limit?: number }, signal?: AbortSignal) =>
			backend.page<StockAdjustmentDto>(`${b(id)}/stock-adjustments`, query, signal),
		deleteProduct: (id: string, productId: string) => backend.delete(`${b(id)}/products/${productId}`),
		/** What "use sample data" will create for a shop type — before the shop exists. */
		samplePreview: (type: BusinessType, signal?: AbortSignal) =>
			backend.get<SamplePreviewDto>(`/catalog/samples/${type}`, undefined, signal),
		seedSample: (id: string) => backend.post<{ products: number }>(`${b(id)}/catalog/sample`),
	},
	orders: {
		checkout: (id: string, input: CheckoutInput) => backend.post<OrderDto>(`${b(id)}/orders`, input),
		list: (
			id: string,
			query: { status?: OrderStatus; method?: PaymentMethod; from?: string; to?: string; search?: string; customerId?: string; page?: number; limit?: number },
			signal?: AbortSignal
		) => backend.page<OrderDto>(`${b(id)}/orders`, query, signal),
		get: (id: string, orderId: string, signal?: AbortSignal) =>
			backend.get<OrderDto>(`${b(id)}/orders/${orderId}`, undefined, signal),
		refund: (id: string, orderId: string, reason?: string) =>
			backend.post<OrderDto>(`${b(id)}/orders/${orderId}/refund`, { reason }),
		cancel: (id: string, orderId: string, reason?: string) =>
			backend.post<OrderDto>(`${b(id)}/orders/${orderId}/cancel`, { reason }),
		/** `delivered: false` means the server has no mail provider configured. */
		sendReceipt: (id: string, orderId: string, email: string) =>
			backend.post<{ delivered: boolean }>(`${b(id)}/orders/${orderId}/receipt-email`, { email }),
	},
	expenses: {
		list: (id: string, query: ExpenseFilters & { limit?: number }, signal?: AbortSignal) =>
			backend.page<ExpenseDto>(`${b(id)}/expenses`, query, signal),
		summary: (id: string, query: Omit<ExpenseFilters, "page">, signal?: AbortSignal) =>
			backend.get<{ total: Satang; byCategory: Partial<Record<ExpenseCategory, Satang>> }>(
				`${b(id)}/expenses/summary`,
				query,
				signal
			),
		create: (id: string, input: ExpenseInput) => backend.post<ExpenseDto>(`${b(id)}/expenses`, input),
		update: (id: string, expenseId: string, input: Partial<ExpenseInput>) =>
			backend.patch<ExpenseDto>(`${b(id)}/expenses/${expenseId}`, input),
		remove: (id: string, expenseId: string) => backend.delete(`${b(id)}/expenses/${expenseId}`),
	},
	customers: {
		list: (id: string, query: { search?: string; page?: number; limit?: number }, signal?: AbortSignal) =>
			backend.page<CustomerDto>(`${b(id)}/customers`, query, signal),
		get: (id: string, customerId: string, signal?: AbortSignal) =>
			backend.get<CustomerDto>(`${b(id)}/customers/${customerId}`, undefined, signal),
		create: (id: string, input: CustomerInput) => backend.post<CustomerDto>(`${b(id)}/customers`, input),
		update: (id: string, customerId: string, input: Partial<CustomerInput>) =>
			backend.patch<CustomerDto>(`${b(id)}/customers/${customerId}`, input),
		remove: (id: string, customerId: string) => backend.delete(`${b(id)}/customers/${customerId}`),
	},
	kitchen: {
		board: (id: string, branchId: string | null, signal?: AbortSignal) =>
			backend.get<KitchenBoardDto>(`${b(id)}/kitchen`, branchId ? { branchId } : undefined, signal),
		setStatus: (id: string, orderId: string, status: KitchenStatus) =>
			backend.patch<KitchenTicketDto>(`${b(id)}/kitchen/${orderId}`, { status }),
		setPrepared: (id: string, orderId: string, itemId: string, prepared: boolean) =>
			backend.patch<KitchenTicketDto>(`${b(id)}/kitchen/${orderId}/items/${itemId}`, { prepared }),
	},
	billing: {
		checkout: (id: string, plan: PlanCode) => backend.post<{ url: string }>(`${b(id)}/billing/checkout`, { plan }),
		change: (id: string, plan: PlanCode) => backend.post(`${b(id)}/billing/change`, { plan }),
		portal: (id: string) => backend.post<{ url: string }>(`${b(id)}/billing/portal`),
	},
	notifications: {
		list: (id: string, signal?: AbortSignal) =>
			backend.get<NotificationListDto>(`${b(id)}/notifications`, undefined, signal),
		markAllRead: (id: string) => backend.post(`${b(id)}/notifications/read`),
		preferences: (id: string, signal?: AbortSignal) =>
			backend.get<NotificationPreferenceDto[]>(`${b(id)}/notifications/preferences`, undefined, signal),
		updatePreferences: (id: string, muted: NotificationKind[]) =>
			backend.put<NotificationPreferenceDto[]>(`${b(id)}/notifications/preferences`, { muted }),
	},
	reports: {
		dashboard: (id: string, range: ReportRange, signal?: AbortSignal) =>
			backend.get<DashboardDto>(`${b(id)}/dashboard`, { range }, signal),
	},
	members: {
		list: (id: string, signal?: AbortSignal) =>
			backend.get<Employee[]>(`${b(id)}/members`, undefined, signal),
		invite: (id: string, input: { email: string; name: string; role: MemberRole }) =>
			backend.post<InviteLinkDto>(`${b(id)}/members`, input),
		regenerateLink: (id: string, memberId: string) =>
			backend.post<InviteLinkDto>(`${b(id)}/members/${memberId}/invite-link`),
		update: (id: string, memberId: string, input: { role?: MemberRole; status?: "ACTIVE" | "DISABLED" }) =>
			backend.patch<Employee>(`${b(id)}/members/${memberId}`, input),
		cancelInvite: (id: string, memberId: string) => backend.delete(`${b(id)}/members/${memberId}`),
		roster: (id: string, signal?: AbortSignal) =>
			backend.get<RosterEntry[]>(`${b(id)}/members/roster`, undefined, signal),
		setMyPin: (id: string, pin: string, password?: string) =>
			backend.put(`${b(id)}/members/me/pin`, { pin, ...(password ? { password } : {}) }),
		clearMyPin: (id: string) => backend.delete(`${b(id)}/members/me/pin`),
		clearPin: (id: string, memberId: string) => backend.delete(`${b(id)}/members/${memberId}/pin`),
		roles: (id: string, signal?: AbortSignal) =>
			backend.get<{ roles: Record<"MANAGER" | "CASHIER" | "STAFF", string[]>; assignable: string[] }>(
				`${b(id)}/members/roles`,
				undefined,
				signal
			),
		/** null returns the member to their role's defaults. */
		setPermissions: (id: string, memberId: string, permissions: string[] | null) =>
			backend.put<Employee>(`${b(id)}/members/${memberId}/permissions`, { permissions }),
	},
	invites: {
		preview: (token: string, signal?: AbortSignal) =>
			backend.get<InvitePreviewDto>(`/invites/${encodeURIComponent(token)}`, undefined, signal),
		accept: (token: string) =>
			backend.post<{ businessId: string; businessName: string; role: MemberRole }>("/invites/accept", { token }),
	},
};
