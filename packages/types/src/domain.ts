import type { Satang } from "@posly/utils/money";

/**
 * The domain as the UI sees it. Mirrors the API's response DTOs by hand — the same contract
 * gov-jobs keeps in `types/api.ts` — so mock data and real data are interchangeable.
 */

export type MemberRole = "OWNER" | "MANAGER" | "CASHIER" | "STAFF";

export type BusinessType =
	| "CAFE"
	| "RESTAURANT"
	| "BEVERAGE"
	| "BAKERY"
	| "RETAIL"
	| "SERVICE"
	| "OTHER";

export interface Branch {
	id: string;
	name: string;
	isDefault: boolean;
}

export interface Business {
	id: string;
	name: string;
	businessType: BusinessType;
	logoUrl: string | null;
	currency: "THB";
	role: MemberRole;
	phone: string | null;
	address: string | null;
	taxId: string | null;
	promptPayId: string | null;
	vatBasisPoints: number;
	pricesIncludeVat: boolean;
	/** Receipt settings (plan §24). A null footer prints the default thank-you line. */
	receiptFooter: string | null;
	receiptShowLogo: boolean;
	receiptShowTaxId: boolean;
	branches: Branch[];
}

/** Drives the product thumbnail illustration until real photos are uploaded. */
export type ProductArt =
	| "coffee"
	| "latte"
	| "matcha"
	| "tea"
	| "chocolate"
	| "croissant"
	| "cake"
	| "brownie"
	| "cookie"
	| "juice"
	| "bottle"
	| "rice"
	| "noodle"
	| "soup"
	| "salad"
	| "bread"
	| "snack"
	| "egg"
	| "milk"
	| "household"
	| "service"
	| "package";

export interface Category {
	id: string;
	name: string;
	icon: string;
	displayOrder: number;
	isActive: boolean;
	/** Its items appear on the kitchen screen. */
	sendToKitchen: boolean;
	productCount: number;
}

export interface ModifierOption {
	id: string;
	name: string;
	priceDelta: Satang;
}

export interface ModifierGroup {
	id: string;
	name: string;
	selection: "SINGLE" | "MULTIPLE";
	required: boolean;
	options: ModifierOption[];
	/** Pre-selected option for a SINGLE group. */
	defaultOptionId?: string;
}

export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "UNTRACKED";

export interface Product {
	id: string;
	name: string;
	categoryId: string;
	price: Satang;
	cost: Satang | null;
	sku: string | null;
	barcode: string | null;
	art: ProductArt;
	imageUrl: string | null;
	trackStock: boolean;
	stock: number | null;
	lowStockAt: number | null;
	unit: string;
	isActive: boolean;
	modifierGroups: ModifierGroup[];
}

export type OrderStatus =
	| "DRAFT"
	| "PENDING_PAYMENT"
	| "PAID"
	| "CANCELLED"
	| "REFUNDED"
	| "PARTIALLY_REFUNDED";

export type PaymentMethod = "CASH" | "PROMPTPAY" | "CARD" | "OTHER";

export interface OrderItemModifier {
	/** Present on cart lines so checkout can send ids; absent on historic order snapshots. */
	optionId?: string;
	groupName: string;
	optionName: string;
	priceDelta: Satang;
}

export interface OrderItem {
	id: string;
	productId: string;
	name: string;
	art: ProductArt;
	quantity: number;
	unitPrice: Satang;
	modifiers: OrderItemModifier[];
	note: string | null;
	lineTotal: Satang;
}

export interface Order {
	id: string;
	number: string;
	createdAt: string;
	employeeName: string;
	paymentMethod: PaymentMethod;
	status: OrderStatus;
	items: OrderItem[];
	subtotal: Satang;
	discount: Satang;
	vat: Satang;
	total: Satang;
	received: Satang | null;
	change: Satang | null;
	customerName: string | null;
	serviceType?: ServiceType | null;
	/** "โต๊ะ 3", "คิว 12": what the counter calls the order out as. */
	label?: string | null;
}

export type ServiceType = "DINE_IN" | "TAKEAWAY" | "DELIVERY";

export interface Employee {
	id: string;
	name: string;
	email: string;
	role: MemberRole;
	status: "ACTIVE" | "INVITED" | "DISABLED";
	lastActiveAt: string | null;
	ordersToday: number;
	inviteExpiresAt?: string | null;
	/** What the member may do now: their role's defaults, or their own list. */
	permissions: string[];
	customPermissions: boolean;
	isYou?: boolean;
	hasPin?: boolean;
}

export interface Customer {
	id: string;
	name: string;
	phone: string | null;
	email: string | null;
	totalOrders: number;
	totalSpending: Satang;
	lastVisitAt: string;
}

export type FeatureKey =
	| "INVENTORY"
	| "CUSTOMERS"
	| "EXPENSES"
	| "ADVANCED_REPORT"
	| "MULTI_BRANCH"
	| "LINE_NOTIFICATION"
	| "KITCHEN_DISPLAY"
	| "ADVANCED_PERMISSION";

export interface SubscriptionPlan {
	code: "FREE" | "STARTER" | "PRO" | "BUSINESS";
	name: string;
	monthlyPrice: Satang;
	highlights: { label: string; soon: boolean }[];
	features: FeatureKey[];
}

export interface Subscription {
	plan: SubscriptionPlan["code"];
	status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELLED";
	currentPeriodEnd: string;
	/** Resolved by the API — the UI asks `hasFeature`, never compares plan codes. */
	features: FeatureKey[];
	ordersThisMonth: number;
	orderLimit: number | null;
}

export type Tone = "primary" | "success" | "warning" | "danger" | "info";
