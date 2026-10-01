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
	tableSelfOpen: boolean;
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
	limits: { orders: number | null; members: number | null; branches: number | null; tables: number | null };
	usage: { ordersThisMonth: number; members: number; branches: number; tables: number };
}

export type PlanCode = "FREE" | "STARTER" | "PRO" | "BUSINESS";

export interface PlanDto {
	code: PlanCode;
	name: string;
	monthlyPrice: Satang;
	orderLimit: number | null;
	memberLimit: number | null;
	branchLimit: number | null;
	tableLimit: number | null;
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
	/** The preset asked for, or "custom" for a from/to range. */
	range: string;
	compare: ReportCompare;
	from: string;
	to: string;
	/** The period the changes compare against. */
	previousFrom: string;
	previousTo: string;
	/** Shop-local days covered. */
	days: number;
	metrics: {
		revenue: Satang;
		revenueChange: number | null;
		orders: number;
		ordersChange: number | null;
		averageOrder: Satang;
		averageOrderChange: number | null;
		/** Cost of the goods sold, from the cost snapshot taken at each sale. */
		cost: Satang;
		/** Sales (less VAT added on top) minus cost of goods — what the dashboard shows. */
		grossProfit: Satang;
		grossProfitChange: number | null;
		/** Expenses recorded for the same days. */
		expenses: Satang;
		/** Of those, the INGREDIENTS category — may overlap the cost of goods. */
		ingredientExpenses: Satang;
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
	/** Active products with no cost entered; their sales count as free. */
	productsWithoutCost: number;
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
	/** Satang paid per unit on a receipt; null when none was entered or without products:write. */
	unitCost: Satang | null;
	/** The product's cost before and after that receipt (equal when a recipe sets it). */
	costBefore: Satang | null;
	costAfter: Satang | null;
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
	/** IN only: satang paid per unit; moves the cost to the weighted average. */
	unitCost?: Satang;
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

/** Against the equal-length period just before, or the same dates a year earlier. */
export type ReportCompare = "previous" | "year";

/**
 * Which figures a report shows: a preset `range`, or a custom `from`–`to` (shop-local days,
 * inclusive). Custom ranges and year-on-year are the Advanced report (ADVANCED_REPORT).
 */
export type ReportQuery = {
	range?: ReportRange;
	from?: string;
	to?: string;
	compare?: ReportCompare;
};

export interface InsightsCustomerRow {
	id: string;
	name: string;
	phone: string | null;
	orders: number;
	revenue: Satang;
	lastOrderAt: string;
}

export interface InsightsProfitRow {
	sold: number;
	/** After each line's share of the order discount. */
	revenue: Satang;
	/** From the cost snapshot on each order line. */
	cost: Satang;
	profit: Satang;
	/** Some of these sales had no cost entered, so the profit reads high. */
	missingCost: boolean;
}

export interface InsightsDto {
	range: string;
	from: string;
	to: string;
	days: number;
	heatmap: {
		/** isodow 1 = Monday … 7 = Sunday; hour 0–23 in the shop's time. Empty cells are absent. */
		cells: { dow: number; hour: number; orders: number; revenue: Satang }[];
		/** How many of each weekday (Mon…Sun) the window holds. */
		weeks: number[];
	};
	products: (InsightsProfitRow & { productId: string | null; name: string; art: ProductArt; category: string | null })[];
	/** `id`/`name` null: products with no category. */
	categories: (InsightsProfitRow & { id: string | null; name: string | null; icon: string | null })[];
	customers: {
		orders: number;
		revenue: Satang;
		identifiedOrders: number;
		identifiedRevenue: Satang;
		customers: number;
		newCustomers: number;
		returningCustomers: number;
		top: InsightsCustomerRow[];
		lapsed: InsightsCustomerRow[];
	};
}

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
	/**
	 * `costDelta` is null for members who cannot edit products; `costFromRecipe` (list only)
	 * means the extra cost is its recipe's, not typed.
	 */
	options: {
		id: string;
		name: string;
		priceDelta: Satang;
		costDelta: Satang | null;
		costFromRecipe?: boolean;
		isDefault: boolean;
	}[];
	defaultOptionId: string | null;
	/** Products using the group (list only). */
	productCount?: number;
}

export interface ModifierGroupInput {
	name: string;
	selection: "SINGLE" | "MULTIPLE";
	required: boolean;
	/** An option with an id keeps it (and any cart holding it); without one it is new. */
	options: { id?: string; name: string; priceDelta: Satang; costDelta?: Satang; isDefault?: boolean }[];
}

export interface IngredientDto {
	id: string;
	name: string;
	/** What recipes measure it in: กรัม, มล., ชิ้น. */
	unit: string;
	/** Satang paid for `purchaseQty` units; null for members who cannot edit products. */
	purchasePrice: Satang | null;
	purchaseQty: number;
	/** Satang per unit, fractional; null like the price. */
	unitCost: number | null;
	trackStock: boolean;
	/** May be below zero: sales never stop over an ingredient. */
	stock: number | null;
	lowStockAt: number | null;
	/** Products and options whose recipe uses it. */
	usedBy: number;
}

export interface IngredientInput {
	name: string;
	unit: string;
	purchasePrice: Satang;
	purchaseQty: number;
	trackStock: boolean;
	stock?: number | null;
	lowStockAt?: number | null;
}

/** Whose recipe: a product's, or a modifier option's. */
export type RecipeOwner = { productId: string } | { optionId: string };

export interface RecipeDto {
	/** `cost` per line is fractional satang. */
	lines: { ingredientId: string; name: string; unit: string; quantity: number; cost: number }[];
	/** Whole satang, as written to the product's cost or the option's extra cost. */
	cost: Satang;
}

export interface IngredientStockInput {
	type: StockAdjustmentType;
	quantity: number;
	/** IN only: satang paid for the whole delivery; moves the price to the weighted average. */
	totalCost?: Satang;
	note?: string;
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
	lines: {
		id: string;
		name: string;
		quantity: number;
		note: string | null;
		modifiers: string[];
		preparedAt: string | null;
		/** Which round of a table tab; 1 for an ordinary sale. */
		round: number;
	}[];
}

export interface KitchenBoardDto {
	open: KitchenTicketDto[];
	recent: KitchenTicketDto[];
}

// ---------------------------------------------------------------- tables

export interface TableDto {
	id: string;
	branchId: string;
	name: string;
	zone: string | null;
	/** How many it seats, if set: a guide for staff, not a limit. */
	seats: number | null;
	displayOrder: number;
	isActive: boolean;
	/** What the table's QR carries: `/t/<qrToken>`. */
	qrToken: string;
	/** A guest's call for staff or the bill, until someone acknowledges it. */
	call: TableCallDto | null;
}

export type TableCallKind = "WAITER" | "BILL";

export interface TableCallDto {
	kind: TableCallKind;
	at: string;
}

export interface TableInput {
	name: string;
	zone?: string | null;
	seats?: number | null;
	displayOrder?: number;
	isActive?: boolean;
}

export interface BoardTableDto extends TableDto {
	tab: { id: string; guests: number | null; openedAt: string; total: Satang; itemCount: number; pendingRequests: number } | null;
}

export type TableRequestStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export interface TableRequestDto {
	id: string;
	status: TableRequestStatus;
	createdAt: string;
	items: { productId: string; name: string; quantity: number; unitPrice: Satang; modifiers: string[]; note: string | null }[];
	total: Satang;
}

export interface TabDto {
	id: string;
	tableId: string;
	tableName: string;
	status: "OPEN" | "CLOSED" | "CANCELLED";
	guests: number | null;
	openedAt: string;
	orderId: string | null;
	orderNumber: string | null;
	kitchenStatus: KitchenStatus | null;
	lines: {
		id: string;
		name: string;
		quantity: number;
		unitPrice: Satang;
		lineTotal: Satang;
		modifiers: string[];
		note: string | null;
		round: number;
		toKitchen: boolean;
		preparedAt: string | null;
	}[];
	subtotal: Satang;
	vat: Satang;
	total: Satang;
	requests: TableRequestDto[];
}

export type RoundItem = CheckoutInput["items"][number];

/** Settling a table: the same money as a checkout, for a bill that already exists. */
export interface CloseTabInput {
	discount: Satang;
	payment: { method: PaymentMethod; received?: Satang };
}

/** Someone who can take over the till, for the lock screen. */
export interface RosterEntry {
	id: string;
	name: string;
	role: MemberRole;
	hasPin: boolean;
	isYou: boolean;
	/** Only ever true on your own entry: you have left yourself off the switch screen. */
	hiddenFromSwitch: boolean;
}

export type NotificationKind =
	| "LOW_STOCK"
	| "OUT_OF_STOCK"
	| "REFUND"
	| "CANCELLED"
	| "DAILY_SUMMARY"
	| "ORDER_QUOTA"
	| "PAYMENT_FAILED"
	| "ANNOUNCEMENT"
	| "TABLE_REQUEST"
	| "TABLE_CALL";

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

const recipePath = (base: string, owner: RecipeOwner) =>
	"productId" in owner ? `${base}/products/${owner.productId}/recipe` : `${base}/modifier-options/${owner.optionId}/recipe`;

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
		ingredients: (id: string, signal?: AbortSignal) =>
			backend.get<IngredientDto[]>(`${b(id)}/ingredients`, undefined, signal),
		createIngredient: (id: string, input: IngredientInput) => backend.post<IngredientDto>(`${b(id)}/ingredients`, input),
		updateIngredient: (id: string, ingredientId: string, input: Partial<IngredientInput>) =>
			backend.patch<IngredientDto>(`${b(id)}/ingredients/${ingredientId}`, input),
		deleteIngredient: (id: string, ingredientId: string) => backend.delete(`${b(id)}/ingredients/${ingredientId}`),
		adjustIngredientStock: (id: string, ingredientId: string, input: IngredientStockInput) =>
			backend.post<IngredientDto>(`${b(id)}/ingredients/${ingredientId}/stock-adjustments`, input),
		recipe: (id: string, owner: RecipeOwner, signal?: AbortSignal) =>
			backend.get<RecipeDto>(recipePath(b(id), owner), undefined, signal),
		setRecipe: (id: string, owner: RecipeOwner, lines: { ingredientId: string; quantity: number }[]) =>
			backend.put<RecipeDto>(recipePath(b(id), owner), { lines }),
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
	tables: {
		list: (id: string, signal?: AbortSignal) => backend.get<TableDto[]>(`${b(id)}/tables`, undefined, signal),
		board: (id: string, signal?: AbortSignal) => backend.get<BoardTableDto[]>(`${b(id)}/tables/board`, undefined, signal),
		create: (id: string, input: TableInput) => backend.post<TableDto>(`${b(id)}/tables`, input),
		update: (id: string, tableId: string, input: Partial<TableInput>) =>
			backend.patch<TableDto>(`${b(id)}/tables/${tableId}`, input),
		remove: (id: string, tableId: string) => backend.delete(`${b(id)}/tables/${tableId}`),
		rotateQr: (id: string, tableId: string) => backend.post<TableDto>(`${b(id)}/tables/${tableId}/rotate-qr`),
		dismissCall: (id: string, tableId: string) => backend.post<TableDto>(`${b(id)}/tables/${tableId}/call/dismiss`),
		open: (id: string, tableId: string, guests?: number) =>
			backend.post<TabDto>(`${b(id)}/tables/${tableId}/open`, guests ? { guests } : {}),
		tab: (id: string, sessionId: string, signal?: AbortSignal) =>
			backend.get<TabDto>(`${b(id)}/table-sessions/${sessionId}`, undefined, signal),
		addRound: (id: string, sessionId: string, clientRequestId: string, items: RoundItem[]) =>
			backend.post<TabDto>(`${b(id)}/table-sessions/${sessionId}/items`, { clientRequestId, items }),
		close: (id: string, sessionId: string, input: CloseTabInput) =>
			backend.post<OrderDto>(`${b(id)}/table-sessions/${sessionId}/close`, input),
		cancel: (id: string, sessionId: string, reason?: string) =>
			backend.post<{ cancelled: true }>(`${b(id)}/table-sessions/${sessionId}/cancel`, { reason }),
		accept: (id: string, requestId: string) => backend.post<TabDto>(`${b(id)}/table-requests/${requestId}/accept`),
		reject: (id: string, requestId: string) => backend.post<TabDto>(`${b(id)}/table-requests/${requestId}/reject`),
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
		dashboard: (id: string, query: ReportRange | ReportQuery, signal?: AbortSignal) =>
			backend.get<DashboardDto>(
				`${b(id)}/dashboard`,
				typeof query === "string" ? { range: query } : query,
				signal
			),
		insights: (id: string, query: ReportQuery, signal?: AbortSignal) =>
			backend.get<InsightsDto>(`${b(id)}/reports/insights`, query, signal),
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
		setSwitchHidden: (id: string, hidden: boolean) =>
			backend.put(`${b(id)}/members/me/switch-visibility`, { hidden }),
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
