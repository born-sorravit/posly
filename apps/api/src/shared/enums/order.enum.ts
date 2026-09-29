/**
 * DRAFT and PENDING_PAYMENT exist for flows that pay later (a gateway-verified PromptPay,
 * a table tab). The MVP checkout creates orders already PAID in one call.
 */
export enum OrderStatus {
	DRAFT = "DRAFT",
	PENDING_PAYMENT = "PENDING_PAYMENT",
	PAID = "PAID",
	CANCELLED = "CANCELLED",
	REFUNDED = "REFUNDED",
	PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED",
}

export enum PaymentStatus {
	PENDING = "PENDING",
	SUCCESS = "SUCCESS",
	FAILED = "FAILED",
	REFUNDED = "REFUNDED",
}

export enum PaymentMethod {
	CASH = "CASH",
	PROMPTPAY = "PROMPTPAY",
	CARD = "CARD",
	OTHER = "OTHER",
}

export enum ModifierSelection {
	SINGLE = "SINGLE",
	MULTIPLE = "MULTIPLE",
}

/**
 * Where a paid order is in the kitchen (plan §27). Null for orders with nothing to cook —
 * a bottle of water never shows up on the kitchen screen.
 */
export enum KitchenStatus {
	NEW = "NEW",
	PREPARING = "PREPARING",
	READY = "READY",
	SERVED = "SERVED",
}

/** How the order leaves the counter; unset when the shop does not ask. */
export enum ServiceType {
	DINE_IN = "DINE_IN",
	TAKEAWAY = "TAKEAWAY",
	DELIVERY = "DELIVERY",
}
