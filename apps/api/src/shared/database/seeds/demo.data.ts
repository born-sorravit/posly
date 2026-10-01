import type { SampleCatalog, SampleGroup } from "@/modules/catalog/sample-catalog";
import { BusinessType } from "@/shared/enums/business-type.enum";
import { MemberRole } from "@/shared/enums/member-role.enum";
import { ModifierSelection } from "@/shared/enums/order.enum";
import { DEMO_EMAIL_DOMAIN } from "@/shared/utils/demo.util";

/**
 * Demo shops for trying Posly without typing a menu first. Three types, so the store
 * switcher, a VAT-registered shop, a non-VAT shop and a stock-heavy retail shop all have
 * something to show. Prices in satang.
 *
 * Every demo account uses `@demo.posly` and every demo shop name is prefixed in the
 * accounts table below, so `seed:demo --reset` can find and remove exactly what it made.
 */
export { DEMO_EMAIL_DOMAIN };
export const DEMO_PASSWORD = "Demo1234!";

export interface DemoAccount {
	key: string;
	email: string;
	name: string;
}

export interface DemoShop {
	name: string;
	businessType: BusinessType;
	phone: string;
	address: string;
	taxId: string | null;
	promptPayId: string | null;
	vatBasisPoints: number;
	pricesIncludeVat: boolean;
	branches: string[];
	members: { account: string; role: MemberRole; displayName: string }[];
	catalog: SampleCatalog;
	/** Typical paid orders per day; the generator varies it by weekday and hour. */
	ordersPerDay: number;
	/** Opening hours in Bangkok time, [open, close). */
	hours: [number, number];
	/** Relative weight per hour of the day — a cafe's morning rush, a minimart's evening. */
	peak: (hour: number) => number;
	/** Tables in the main branch, by zone, for dine-in and QR ordering. */
	tables?: { zone: string; seats: number; names: string[] }[];
	/** What the kitchen buys, so recipes can cost the menu (Inventory feature). */
	ingredients?: DemoIngredient[];
	/**
	 * Recipes as [ingredient key, quantity]. Products by name; options as "group:option".
	 * A recipe replaces the typed cost — the seed writes the recipe's cost instead.
	 */
	recipes?: {
		products: Record<string, DemoRecipe>;
		options: Record<string, DemoRecipe>;
	};
}

export interface DemoIngredient {
	key: string;
	name: string;
	unit: string;
	/** Satang paid for `purchaseQty` units. */
	purchasePrice: number;
	purchaseQty: number;
	/** Tracked ingredients only. */
	stock?: number;
	lowStockAt?: number;
}

export type DemoRecipe = [ingredient: string, quantity: number][];

export const DEMO_ACCOUNTS: DemoAccount[] = [
	{ key: "nan", email: `nan@${DEMO_EMAIL_DOMAIN}`, name: "คุณแนน" },
	{ key: "mind", email: `mind@${DEMO_EMAIL_DOMAIN}`, name: "มายด์" },
	{ key: "ton", email: `ton@${DEMO_EMAIL_DOMAIN}`, name: "ต้น" },
	{ key: "daeng", email: `daeng@${DEMO_EMAIL_DOMAIN}`, name: "ป้าแดง" },
	{ key: "boss", email: `boss@${DEMO_EMAIL_DOMAIN}`, name: "บอส" },
];

const SIZE: SampleGroup = {
	key: "size",
	name: "ขนาด",
	selection: ModifierSelection.SINGLE,
	required: true,
	options: [
		{ name: "S", priceDelta: 0 },
		{ name: "M", priceDelta: 1000, costDelta: 300, isDefault: true },
		{ name: "L", priceDelta: 2000, costDelta: 600 },
	],
};

const SWEET: SampleGroup = {
	key: "sweet",
	name: "ความหวาน",
	selection: ModifierSelection.SINGLE,
	required: true,
	options: [
		{ name: "0%", priceDelta: 0 },
		{ name: "25%", priceDelta: 0 },
		{ name: "50%", priceDelta: 0, isDefault: true },
		{ name: "75%", priceDelta: 0 },
		{ name: "100%", priceDelta: 0 },
	],
};

const EXTRA: SampleGroup = {
	key: "extra",
	name: "เพิ่มเติม",
	selection: ModifierSelection.MULTIPLE,
	required: false,
	options: [
		{ name: "Extra Shot", priceDelta: 1500, costDelta: 500 },
		{ name: "Oat Milk", priceDelta: 2000, costDelta: 900 },
		{ name: "วิปครีม", priceDelta: 1000, costDelta: 400 },
	],
};

const TEMP: SampleGroup = {
	key: "temp",
	name: "แบบ",
	selection: ModifierSelection.SINGLE,
	required: true,
	options: [
		{ name: "ร้อน", priceDelta: 0 },
		{ name: "เย็น", priceDelta: 500, isDefault: true },
		{ name: "ปั่น", priceDelta: 1500, costDelta: 300 },
	],
};

const WARM: SampleGroup = {
	key: "warm",
	name: "อุ่นไหม",
	selection: ModifierSelection.SINGLE,
	required: false,
	options: [
		{ name: "ไม่อุ่น", priceDelta: 0, isDefault: true },
		{ name: "อุ่น", priceDelta: 0 },
	],
};

const DRINK = ["temp", "size", "sweet", "extra"];

export const DEMO_SHOPS: DemoShop[] = [
	{
		name: "Sunny Cafe",
		businessType: BusinessType.CAFE,
		phone: "081-234-5678",
		address: "188 ถนนพระราม 1 แขวงปทุมวัน เขตปทุมวัน กรุงเทพฯ 10330",
		taxId: "0105561234567",
		promptPayId: "0812345678",
		vatBasisPoints: 700,
		pricesIncludeVat: false,
		branches: ["สาขาสยามสแควร์", "สาขาอารีย์"],
		tables: [
			{
				zone: "ในร้าน",
				seats: 4,
				names: ["โต๊ะ 1", "โต๊ะ 2", "โต๊ะ 3", "โต๊ะ 4", "โต๊ะ 5", "โต๊ะ 6"],
			},
			{ zone: "ระเบียง", seats: 2, names: ["โต๊ะ 7", "โต๊ะ 8"] },
		],
		members: [
			{ account: "nan", role: MemberRole.OWNER, displayName: "คุณแนน" },
			{ account: "ton", role: MemberRole.MANAGER, displayName: "ต้น" },
			{ account: "mind", role: MemberRole.CASHIER, displayName: "มายด์" },
		],
		ordersPerDay: 70,
		hours: [7, 19],
		peak: (h) =>
			h >= 7 && h < 10 ? 3 : h >= 12 && h < 14 ? 2 : h >= 15 && h < 17 ? 1.5 : 1,
		// Drinks are made from a recipe; bottles and pastries are bought in at a typed cost,
		// so the demo shows both kinds side by side.
		ingredients: [
			{
				key: "beans",
				name: "เมล็ดกาแฟคั่ว",
				unit: "กรัม",
				purchasePrice: 65_000,
				purchaseQty: 1000,
				stock: 2400,
				lowStockAt: 1000,
			},
			{
				key: "milk",
				name: "นมสด",
				unit: "มล.",
				purchasePrice: 9500,
				purchaseQty: 2000,
				stock: 9000,
				lowStockAt: 4000,
			},
			{
				key: "oat",
				name: "นมโอ๊ต",
				unit: "มล.",
				purchasePrice: 11_500,
				purchaseQty: 1000,
			},
			{
				key: "cup",
				name: "แก้วพร้อมฝา",
				unit: "ชิ้น",
				purchasePrice: 25_000,
				purchaseQty: 50,
				stock: 180,
				lowStockAt: 100,
			},
			{
				key: "syrup",
				name: "น้ำเชื่อม",
				unit: "มล.",
				purchasePrice: 8000,
				purchaseQty: 750,
			},
			{
				key: "caramel",
				name: "ซอสคาราเมล",
				unit: "มล.",
				purchasePrice: 29_000,
				purchaseQty: 1000,
			},
			{
				key: "cocoa",
				name: "ผงโกโก้",
				unit: "กรัม",
				purchasePrice: 22_000,
				purchaseQty: 500,
			},
			{
				key: "thaiTea",
				name: "ผงชาไทย",
				unit: "กรัม",
				purchasePrice: 18_000,
				purchaseQty: 400,
			},
			{
				key: "greenTea",
				name: "ผงชาเขียว",
				unit: "กรัม",
				purchasePrice: 16_000,
				purchaseQty: 200,
			},
			// Below its reorder point, so the page and the bell have something to warn about.
			{
				key: "matcha",
				name: "ผงมัทฉะ",
				unit: "กรัม",
				purchasePrice: 35_000,
				purchaseQty: 100,
				stock: 60,
				lowStockAt: 100,
			},
			{
				key: "condensed",
				name: "นมข้นหวาน",
				unit: "กรัม",
				purchasePrice: 3200,
				purchaseQty: 380,
			},
			{
				key: "whip",
				name: "วิปครีม",
				unit: "มล.",
				purchasePrice: 14_500,
				purchaseQty: 1000,
			},
		],
		recipes: {
			products: {
				Americano: [
					["beans", 18],
					["cup", 1],
				],
				Espresso: [
					["beans", 18],
					["cup", 1],
				],
				Latte: [
					["beans", 18],
					["milk", 180],
					["cup", 1],
				],
				Cappuccino: [
					["beans", 18],
					["milk", 150],
					["cup", 1],
				],
				Mocha: [
					["beans", 18],
					["milk", 150],
					["cocoa", 15],
					["cup", 1],
				],
				"Caramel Macchiato": [
					["beans", 18],
					["milk", 180],
					["caramel", 20],
					["cup", 1],
				],
				"Thai Tea": [
					["thaiTea", 20],
					["condensed", 30],
					["milk", 60],
					["cup", 1],
				],
				"Matcha Latte": [
					["matcha", 4],
					["milk", 150],
					["cup", 1],
				],
				"Green Tea": [
					["greenTea", 10],
					["syrup", 20],
					["cup", 1],
				],
				Chocolate: [
					["cocoa", 25],
					["milk", 180],
					["cup", 1],
				],
			},
			options: {
				"extra:Extra Shot": [["beans", 9]],
				"extra:Oat Milk": [["oat", 80]],
				"extra:วิปครีม": [["whip", 30]],
			},
		},
		catalog: {
			groups: [TEMP, SIZE, SWEET, EXTRA, WARM],
			categories: [
				{
					name: "กาแฟ",
					icon: "coffee",
					products: [
						{
							name: "Americano",
							price: 6000,
							cost: 1800,
							art: "coffee",
							unit: "แก้ว",
							groups: DRINK,
						},
						{
							name: "Espresso",
							price: 5500,
							cost: 1600,
							art: "coffee",
							unit: "แก้ว",
							groups: ["temp", "sweet"],
						},
						{
							name: "Latte",
							price: 7000,
							cost: 2200,
							art: "latte",
							unit: "แก้ว",
							groups: DRINK,
						},
						{
							name: "Cappuccino",
							price: 7000,
							cost: 2200,
							art: "latte",
							unit: "แก้ว",
							groups: DRINK,
						},
						{
							name: "Mocha",
							price: 7500,
							cost: 2600,
							art: "chocolate",
							unit: "แก้ว",
							groups: DRINK,
						},
						{
							name: "Caramel Macchiato",
							price: 8000,
							cost: 2700,
							art: "latte",
							unit: "แก้ว",
							groups: DRINK,
						},
					],
				},
				{
					name: "ชา",
					icon: "leaf",
					products: [
						{
							name: "Thai Tea",
							price: 6500,
							cost: 1700,
							art: "tea",
							unit: "แก้ว",
							groups: ["temp", "size", "sweet"],
						},
						{
							name: "Matcha Latte",
							price: 7500,
							cost: 2500,
							art: "matcha",
							unit: "แก้ว",
							groups: ["temp", "size", "sweet"],
						},
						{
							name: "Green Tea",
							price: 6000,
							cost: 1600,
							art: "matcha",
							unit: "แก้ว",
							groups: ["temp", "size", "sweet"],
						},
					],
				},
				{
					name: "นม & อื่นๆ",
					icon: "milk",
					products: [
						{
							name: "Chocolate",
							price: 6500,
							cost: 2000,
							art: "chocolate",
							unit: "แก้ว",
							groups: ["temp", "size", "sweet"],
						},
						{
							name: "Orange Juice",
							price: 5500,
							cost: 2000,
							art: "juice",
							unit: "ขวด",
							stock: 18,
						},
						{
							name: "Mineral Water",
							price: 2000,
							cost: 700,
							art: "bottle",
							unit: "ขวด",
							stock: 60,
						},
					],
				},
				{
					name: "ขนม",
					icon: "croissant",
					products: [
						{
							name: "Croissant",
							price: 6500,
							cost: 2400,
							art: "croissant",
							unit: "ชิ้น",
							groups: ["warm"],
							stock: 24,
						},
						{
							name: "Cheesecake",
							price: 8500,
							cost: 3000,
							art: "cake",
							unit: "ชิ้น",
							stock: 4,
						},
						{
							name: "Brownie",
							price: 7200,
							cost: 2500,
							art: "brownie",
							unit: "ชิ้น",
							groups: ["warm"],
							stock: 16,
						},
						{
							name: "Cookie",
							price: 4500,
							cost: 1200,
							art: "cookie",
							unit: "ชิ้น",
							stock: 40,
						},
					],
				},
			],
		},
	},
	{
		name: "Baan Bakery",
		businessType: BusinessType.BAKERY,
		phone: "02-555-0192",
		address: "45 ซอยอารีย์ 1 แขวงสามเสนใน เขตพญาไท กรุงเทพฯ 10400",
		taxId: null,
		promptPayId: "0891112233",
		vatBasisPoints: 0,
		pricesIncludeVat: true,
		branches: ["หน้าร้าน"],
		members: [
			// The same owner as Sunny Cafe, so the store switcher has two shops to switch between.
			{ account: "nan", role: MemberRole.OWNER, displayName: "คุณแนน" },
			{ account: "boss", role: MemberRole.CASHIER, displayName: "บอส" },
		],
		ordersPerDay: 40,
		hours: [8, 20],
		peak: (h) => (h >= 8 && h < 11 ? 2 : h >= 15 && h < 18 ? 2.5 : 1),
		catalog: {
			groups: [WARM],
			categories: [
				{
					name: "ขนมปัง",
					icon: "croissant",
					products: [
						{
							name: "Croissant",
							price: 5500,
							cost: 1900,
							art: "croissant",
							unit: "ชิ้น",
							groups: ["warm"],
							stock: 30,
						},
						{
							name: "Pain au Chocolat",
							price: 6500,
							cost: 2300,
							art: "croissant",
							unit: "ชิ้น",
							groups: ["warm"],
							stock: 20,
						},
						{
							name: "ขนมปังนมสด",
							price: 4500,
							cost: 1400,
							art: "croissant",
							unit: "ก้อน",
							stock: 25,
						},
						{
							name: "Garlic Bread",
							price: 5000,
							cost: 1500,
							art: "croissant",
							unit: "ชิ้น",
							groups: ["warm"],
							stock: 18,
						},
					],
				},
				{
					name: "เค้ก",
					icon: "croissant",
					products: [
						{
							name: "Cheesecake",
							price: 9500,
							cost: 3200,
							art: "cake",
							unit: "ชิ้น",
							stock: 10,
						},
						{
							name: "Chocolate Cake",
							price: 8500,
							cost: 2900,
							art: "cake",
							unit: "ชิ้น",
							stock: 3,
						},
						{
							name: "Strawberry Shortcake",
							price: 9000,
							cost: 3100,
							art: "cake",
							unit: "ชิ้น",
							stock: 8,
						},
					],
				},
				{
					name: "คุกกี้ & บราวนี่",
					icon: "croissant",
					products: [
						{
							name: "Brownie",
							price: 6500,
							cost: 2200,
							art: "brownie",
							unit: "ชิ้น",
							stock: 24,
						},
						{
							name: "Choc Chip Cookie",
							price: 3500,
							cost: 900,
							art: "cookie",
							unit: "ชิ้น",
							stock: 50,
						},
						{
							name: "Butter Cookie (กล่อง)",
							price: 18_000,
							cost: 6000,
							art: "cookie",
							unit: "กล่อง",
							stock: 0,
						},
					],
				},
				{
					name: "เครื่องดื่ม",
					icon: "cup-soda",
					products: [
						{
							name: "Iced Latte",
							price: 6500,
							cost: 2000,
							art: "latte",
							unit: "แก้ว",
						},
						{ name: "Thai Tea", price: 5500, cost: 1500, art: "tea", unit: "แก้ว" },
					],
				},
			],
		},
	},
	{
		name: "ร้านป้าแดง มินิมาร์ท",
		businessType: BusinessType.RETAIL,
		phone: "089-765-4321",
		address: "99/9 หมู่ 3 ตำบลสุเทพ อำเภอเมือง เชียงใหม่ 50200",
		taxId: null,
		promptPayId: "0897654321",
		vatBasisPoints: 700,
		// Shelf prices already include VAT, as they do in every Thai minimart.
		pricesIncludeVat: true,
		branches: ["สาขาหลัก"],
		members: [{ account: "daeng", role: MemberRole.OWNER, displayName: "ป้าแดง" }],
		ordersPerDay: 90,
		hours: [6, 22],
		peak: (h) => (h >= 6 && h < 9 ? 1.5 : h >= 17 && h < 21 ? 3 : 1),
		catalog: {
			groups: [],
			categories: [
				{
					name: "เครื่องดื่ม",
					icon: "cup-soda",
					products: [
						{
							name: "น้ำดื่ม 600ml",
							price: 700,
							cost: 400,
							art: "bottle",
							unit: "ขวด",
							stock: 240,
						},
						{
							name: "โค้ก 325ml",
							price: 1700,
							cost: 1200,
							art: "juice",
							unit: "กระป๋อง",
							stock: 96,
						},
						{
							name: "นมจืด UHT",
							price: 1500,
							cost: 1050,
							art: "bottle",
							unit: "กล่อง",
							stock: 72,
						},
						{
							name: "กาแฟกระป๋อง",
							price: 1800,
							cost: 1250,
							art: "coffee",
							unit: "กระป๋อง",
							stock: 48,
						},
						{
							name: "น้ำส้ม 1L",
							price: 5900,
							cost: 4200,
							art: "juice",
							unit: "ขวด",
							stock: 6,
						},
					],
				},
				{
					name: "ขนม & ของกินเล่น",
					icon: "package",
					products: [
						{
							name: "มันฝรั่งทอด",
							price: 2000,
							cost: 1400,
							art: "cookie",
							unit: "ห่อ",
							stock: 60,
						},
						{
							name: "ขนมปังแซนด์วิช",
							price: 2500,
							cost: 1700,
							art: "croissant",
							unit: "ชิ้น",
							stock: 20,
						},
						{
							name: "ช็อกโกแลตบาร์",
							price: 2500,
							cost: 1800,
							art: "brownie",
							unit: "ชิ้น",
							stock: 40,
						},
						{
							name: "คุกกี้กล่อง",
							price: 3900,
							cost: 2800,
							art: "cookie",
							unit: "กล่อง",
							stock: 2,
						},
					],
				},
				{
					name: "ของใช้",
					icon: "package",
					products: [
						{
							name: "มาม่า ต้มยำกุ้ง",
							price: 700,
							cost: 520,
							art: "bottle",
							unit: "ซอง",
							stock: 150,
						},
						{
							name: "ไข่ไก่ (แผง 10 ฟอง)",
							price: 5500,
							cost: 4500,
							art: "bottle",
							unit: "แผง",
							stock: 12,
						},
						{
							name: "ทิชชู่ม้วน",
							price: 2900,
							cost: 2100,
							art: "bottle",
							unit: "แพ็ก",
							stock: 30,
						},
						{
							name: "สบู่ก้อน",
							price: 2500,
							cost: 1700,
							art: "bottle",
							unit: "ก้อน",
							stock: 0,
						},
					],
				},
			],
		},
	},
];
