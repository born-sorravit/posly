/** Thai labels and status tones for the API's enum values. */

export const PLAN_LABEL: Record<string, string> = {
	FREE: "Free",
	STARTER: "Starter",
	PRO: "Pro",
	BUSINESS: "Business",
};

export const SUBSCRIPTION_STATUS: Record<string, { label: string; tone: "good" | "info" | "warning" | "neutral" }> = {
	ACTIVE: { label: "ใช้งาน", tone: "good" },
	TRIALING: { label: "ทดลองใช้", tone: "info" },
	PAST_DUE: { label: "ค้างชำระ", tone: "warning" },
	CANCELLED: { label: "ยกเลิกแล้ว", tone: "neutral" },
};

export const ORDER_STATUS: Record<string, { label: string; tone: "good" | "warning" | "critical" | "neutral" }> = {
	PAID: { label: "ชำระแล้ว", tone: "good" },
	PENDING_PAYMENT: { label: "รอชำระ", tone: "warning" },
	DRAFT: { label: "ร่าง", tone: "neutral" },
	CANCELLED: { label: "ยกเลิก", tone: "neutral" },
	REFUNDED: { label: "คืนเงิน", tone: "critical" },
	PARTIALLY_REFUNDED: { label: "คืนเงินบางส่วน", tone: "warning" },
};

export const AUDIT_ACTION: Record<string, string> = {
	ORDER_REFUNDED: "คืนเงินออเดอร์",
	ORDER_CANCELLED: "ยกเลิกออเดอร์",
	STOCK_ADJUSTED: "ปรับสต็อก",
};

export const ROLE_LABEL: Record<string, string> = {
	OWNER: "เจ้าของ",
	MANAGER: "ผู้จัดการ",
	CASHIER: "แคชเชียร์",
	STAFF: "พนักงาน",
};

export const MEMBER_STATUS: Record<string, string> = {
	ACTIVE: "ใช้งาน",
	INVITED: "รอตอบรับ",
	DISABLED: "ปิดใช้งาน",
};

export const BUSINESS_TYPE: Record<string, string> = {
	CAFE: "คาเฟ่",
	RESTAURANT: "ร้านอาหาร",
	BEVERAGE: "ร้านเครื่องดื่ม",
	BAKERY: "เบเกอรี่",
	RETAIL: "ร้านค้าปลีก",
	SERVICE: "บริการ",
	OTHER: "อื่น ๆ",
};
