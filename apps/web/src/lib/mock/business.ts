import type {
	Business,
	Customer,
} from "@posly/types/domain";

export const BUSINESSES: Business[] = [
	{
		id: "biz-sunny",
		name: "Sunny Cafe",
		businessType: "CAFE",
		logoUrl: null,
		currency: "THB",
		role: "OWNER",
		phone: "081-234-5678",
		address: "188 ถนนพระราม 1 แขวงปทุมวัน เขตปทุมวัน กรุงเทพฯ 10330",
		taxId: "0105561234567",
		promptPayId: "0812345678",
		vatBasisPoints: 700,
		pricesIncludeVat: false,
		receiptFooter: null,
		receiptShowLogo: true,
		receiptShowTaxId: true,
	tableSelfOpen: true,
		branches: [
			{ id: "br-siam", name: "สาขาสยามสแควร์", isDefault: true },
			{ id: "br-phuket", name: "สาขาภูเก็ต", isDefault: false },
			{ id: "br-cnx", name: "สาขาเชียงใหม่", isDefault: false },
		],
	},
	{
		id: "biz-bake",
		name: "Baan Bakery",
		businessType: "BAKERY",
		logoUrl: null,
		currency: "THB",
		role: "MANAGER",
		phone: null,
		address: null,
		taxId: null,
		promptPayId: null,
		vatBasisPoints: 0,
		pricesIncludeVat: true,
		receiptFooter: null,
		receiptShowLogo: true,
		receiptShowTaxId: true,
	tableSelfOpen: true,
		branches: [{ id: "br-bake-1", name: "สาขาหลัก", isDefault: true }],
	},
];

export const CURRENT_USER = {
	id: "u-nan",
	name: "คุณแนน",
	email: "nan@sunnycafe.co",
	role: "OWNER" as const,
};

export const CUSTOMERS: Customer[] = [
	{ id: "c-1", name: "คุณพลอย", phone: "089-111-2233", email: null, totalOrders: 42, totalSpending: 356_000, lastVisitAt: "2026-09-28T02:15:00Z" },
	{ id: "c-2", name: "Mr. James", phone: null, email: "james@example.com", totalOrders: 18, totalSpending: 142_500, lastVisitAt: "2026-09-26T08:40:00Z" },
	{ id: "c-3", name: "คุณเก่ง", phone: "081-555-7788", email: null, totalOrders: 7, totalSpending: 51_000, lastVisitAt: "2026-09-21T05:05:00Z" },
];
