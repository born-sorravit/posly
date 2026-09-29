import type { Order, PaymentMethod, ProductArt } from "@posly/types/domain";

/**
 * Mock sales figures, shaped like the dashboard and report endpoints will answer.
 * All amounts are satang.
 */

export const TODAY_METRICS = {
	revenue: 1_245_000,
	revenueChange: 0.142,
	orders: 127,
	ordersChange: 0.123,
	averageOrder: 9800,
	averageOrderChange: 0.017,
	estimatedProfit: 432_000,
	profitChange: 0.08,
};

export const SALES_7_DAYS = [
	{ label: "20", date: "2026-09-20", revenue: 520_000, orders: 61 },
	{ label: "21", date: "2026-09-21", revenue: 810_000, orders: 88 },
	{ label: "22", date: "2026-09-22", revenue: 720_000, orders: 79 },
	{ label: "23", date: "2026-09-23", revenue: 1_050_000, orders: 104 },
	{ label: "24", date: "2026-09-24", revenue: 1_010_000, orders: 99 },
	{ label: "25", date: "2026-09-25", revenue: 1_320_000, orders: 121 },
	{ label: "26", date: "2026-09-26", revenue: 1_560_000, orders: 139 },
];

export const SALES_TODAY_HOURLY = [
	{ label: "07", revenue: 42_000, orders: 6 },
	{ label: "08", revenue: 138_000, orders: 17 },
	{ label: "09", revenue: 186_000, orders: 21 },
	{ label: "10", revenue: 121_000, orders: 13 },
	{ label: "11", revenue: 98_000, orders: 10 },
	{ label: "12", revenue: 176_000, orders: 16 },
	{ label: "13", revenue: 154_000, orders: 14 },
	{ label: "14", revenue: 112_000, orders: 11 },
	{ label: "15", revenue: 96_000, orders: 9 },
	{ label: "16", revenue: 70_000, orders: 6 },
	{ label: "17", revenue: 52_000, orders: 4 },
];

export const SALES_30_DAYS = Array.from({ length: 30 }, (_, i) => {
	// A weekly rhythm with weekends higher, drifting upward — enough shape to read a chart.
	const day = new Date(Date.UTC(2026, 7, 28 + i));
	const weekend = day.getUTCDay() === 0 || day.getUTCDay() === 6;
	const base = 700_000 + i * 18_000 + (weekend ? 320_000 : 0);
	const wobble = ((i * 7919) % 13) * 9_000;
	const revenue = base + wobble;
	return {
		label: String(day.getUTCDate()),
		date: day.toISOString().slice(0, 10),
		revenue,
		orders: Math.round(revenue / 9_600),
	};
});

export const TOP_PRODUCTS: { name: string; art: ProductArt; sold: number; revenue: number }[] = [
	{ name: "Americano", art: "coffee", sold: 52, revenue: 312_000 },
	{ name: "Latte", art: "latte", sold: 41, revenue: 287_000 },
	{ name: "Matcha Latte", art: "matcha", sold: 32, revenue: 206_000 },
	{ name: "Thai Tea", art: "tea", sold: 28, revenue: 196_000 },
	{ name: "Croissant", art: "croissant", sold: 18, revenue: 136_000 },
];

export const LOW_SELLING: { name: string; art: ProductArt; sold: number; revenue: number }[] = [
	{ name: "Mineral Water", art: "bottle", sold: 2, revenue: 4_000 },
	{ name: "Orange Juice", art: "juice", sold: 3, revenue: 16_500 },
	{ name: "Cookie", art: "cookie", sold: 4, revenue: 18_000 },
];

export const PAYMENT_BREAKDOWN: { method: PaymentMethod; amount: number; count: number }[] = [
	{ method: "PROMPTPAY", amount: 882_000, count: 86 },
	{ method: "CASH", amount: 268_000, count: 34 },
	{ method: "CARD", amount: 95_000, count: 7 },
];

export const LOW_STOCK_ALERTS = [
	{ id: "ls-1", name: "Matcha Powder", remaining: "เหลือ 5 ถุง", tone: "danger" as const },
	{ id: "ls-2", name: "Coffee Beans", remaining: "เหลือ 500g", tone: "warning" as const },
	{ id: "ls-3", name: "Milk", remaining: "เหลือ 3 ขวด", tone: "warning" as const },
];

export const EMPLOYEE_PERFORMANCE = [
	{ name: "มายด์", orders: 58, revenue: 562_000, refunds: 0, discounts: 4_000 },
	{ name: "ต้น", orders: 31, revenue: 318_000, refunds: 7_000, discounts: 12_000 },
	{ name: "บอส", orders: 26, revenue: 251_000, refunds: 0, discounts: 0 },
	{ name: "คุณแนน", orders: 12, revenue: 114_000, refunds: 0, discounts: 2_000 },
];

const order = (
	seq: number,
	createdAt: string,
	employeeName: string,
	paymentMethod: PaymentMethod,
	status: Order["status"],
	items: Order["items"],
	extra: Partial<Order> = {}
): Order => {
	const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
	const discount = extra.discount ?? 0;
	const vat = Math.round(((subtotal - discount) * 700) / 10_000);
	const total = subtotal - discount + vat;
	return {
		id: `ord-${seq}`,
		number: String(seq).padStart(6, "0"),
		createdAt,
		employeeName,
		paymentMethod,
		status,
		items,
		subtotal,
		discount,
		vat,
		total,
		received: paymentMethod === "CASH" ? Math.ceil(total / 10_000) * 10_000 : null,
		change: paymentMethod === "CASH" ? Math.ceil(total / 10_000) * 10_000 - total : null,
		customerName: null,
		...extra,
	};
};

const item = (
	id: string,
	name: string,
	art: ProductArt,
	quantity: number,
	unitPrice: number,
	modifiers: Order["items"][number]["modifiers"] = []
): Order["items"][number] => ({
	id,
	productId: id,
	name,
	art,
	quantity,
	unitPrice,
	modifiers,
	note: null,
	lineTotal: unitPrice * quantity,
});

export const ORDERS: Order[] = [
	order(124, "2026-09-28T03:24:00Z", "มายด์", "PROMPTPAY", "PAID", [
		item("i1", "Americano", "coffee", 1, 6000, [{ groupName: "ความหวาน", optionName: "ไม่หวาน", priceDelta: 0 }]),
		item("i2", "Latte", "latte", 1, 7000),
		item("i3", "Matcha Latte", "matcha", 1, 7000),
		item("i4", "Croissant", "croissant", 1, 6500),
	]),
	order(123, "2026-09-28T03:10:00Z", "มายด์", "CASH", "PAID", [
		item("i5", "Thai Tea", "tea", 2, 6500),
		item("i6", "Brownie", "brownie", 1, 7200),
	]),
	order(122, "2026-09-28T02:58:00Z", "ต้น", "CARD", "PAID", [
		item("i7", "Cappuccino", "latte", 2, 8000, [{ groupName: "ขนาด", optionName: "M", priceDelta: 1000 }]),
	]),
	order(121, "2026-09-28T02:41:00Z", "บอส", "PROMPTPAY", "PAID", [
		item("i8", "Mocha", "chocolate", 1, 7500),
		item("i9", "Cheesecake", "cake", 1, 8000),
	], { customerName: "คุณพลอย" }),
	order(120, "2026-09-28T02:20:00Z", "มายด์", "CASH", "CANCELLED", [
		item("i10", "Americano", "coffee", 1, 6000),
	]),
	order(119, "2026-09-28T02:02:00Z", "ต้น", "PROMPTPAY", "PAID", [
		item("i11", "Latte", "latte", 3, 7000),
		item("i12", "Cookie", "cookie", 2, 4500),
	], { discount: 2000 }),
	order(118, "2026-09-28T01:48:00Z", "ต้น", "PROMPTPAY", "REFUNDED", [
		item("i13", "Latte", "latte", 1, 7000),
	]),
	order(117, "2026-09-28T01:30:00Z", "บอส", "CASH", "PAID", [
		item("i14", "Green Tea", "matcha", 1, 6000),
		item("i15", "Croissant", "croissant", 2, 6500),
	]),
	order(116, "2026-09-28T01:12:00Z", "มายด์", "PROMPTPAY", "PARTIALLY_REFUNDED", [
		item("i16", "Americano", "coffee", 2, 6000),
		item("i17", "Cheesecake", "cake", 1, 8000),
	]),
	order(115, "2026-09-28T00:55:00Z", "คุณแนน", "OTHER", "PAID", [
		item("i18", "Chocolate", "chocolate", 1, 6500),
	]),
];
