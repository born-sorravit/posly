import { BusinessType } from "@/shared/enums/business-type.enum";
import { ModifierSelection } from "@/shared/enums/order.enum";

/**
 * Starter menus for onboarding's "use sample data" (plan §6). Prices in satang.
 *
 * Kept on the server so every client seeds the same catalogue and the frontend never has to
 * know what a bakery sells.
 */
export interface SampleGroup {
	key: string;
	name: string;
	selection: ModifierSelection;
	required: boolean;
	options: {
		name: string;
		priceDelta: number;
		costDelta?: number;
		isDefault?: boolean;
	}[];
}

export interface SampleCatalog {
	groups: SampleGroup[];
	categories: {
		name: string;
		icon: string;
		products: {
			name: string;
			price: number;
			cost: number;
			art: string;
			unit: string;
			groups?: string[];
			stock?: number;
		}[];
	}[];
}

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

const SWEETNESS: SampleGroup = {
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

const EXTRAS: SampleGroup = {
	key: "extra",
	name: "เพิ่มเติม",
	selection: ModifierSelection.MULTIPLE,
	required: false,
	options: [
		{ name: "Extra Shot", priceDelta: 1500, costDelta: 500 },
		{ name: "Oat Milk", priceDelta: 2000, costDelta: 900 },
	],
};

const CAFE: SampleCatalog = {
	groups: [SIZE, SWEETNESS, EXTRAS],
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
					groups: ["size", "sweet", "extra"],
				},
				{
					name: "Latte",
					price: 7000,
					cost: 2200,
					art: "latte",
					unit: "แก้ว",
					groups: ["size", "sweet", "extra"],
				},
				{
					name: "Cappuccino",
					price: 7000,
					cost: 2200,
					art: "latte",
					unit: "แก้ว",
					groups: ["size", "sweet", "extra"],
				},
			],
		},
		{
			name: "ชา",
			icon: "leaf",
			products: [
				{
					name: "Green Tea",
					price: 6000,
					cost: 1600,
					art: "matcha",
					unit: "แก้ว",
					groups: ["size", "sweet"],
				},
				{
					name: "Thai Tea",
					price: 6500,
					cost: 1700,
					art: "tea",
					unit: "แก้ว",
					groups: ["size", "sweet"],
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
					stock: 12,
				},
			],
		},
	],
};

const BAKERY: SampleCatalog = {
	groups: [],
	categories: [
		{
			name: "ขนมปัง",
			icon: "croissant",
			products: [
				{
					name: "Croissant",
					price: 6500,
					cost: 2400,
					art: "croissant",
					unit: "ชิ้น",
					stock: 20,
				},
				{
					name: "Brownie",
					price: 7200,
					cost: 2500,
					art: "brownie",
					unit: "ชิ้น",
					stock: 15,
				},
				{
					name: "Cookie",
					price: 4500,
					cost: 1200,
					art: "cookie",
					unit: "ชิ้น",
					stock: 30,
				},
			],
		},
		{
			name: "เค้ก",
			icon: "croissant",
			products: [
				{
					name: "Cheesecake",
					price: 8000,
					cost: 3000,
					art: "cake",
					unit: "ชิ้น",
					stock: 8,
				},
			],
		},
	],
};

const BEVERAGE: SampleCatalog = {
	groups: [SIZE, SWEETNESS],
	categories: [
		{
			name: "ชา",
			icon: "leaf",
			products: [
				{
					name: "Thai Tea",
					price: 5500,
					cost: 1500,
					art: "tea",
					unit: "แก้ว",
					groups: ["size", "sweet"],
				},
				{
					name: "Matcha Latte",
					price: 6500,
					cost: 2300,
					art: "matcha",
					unit: "แก้ว",
					groups: ["size", "sweet"],
				},
			],
		},
		{
			name: "เครื่องดื่ม",
			icon: "cup-soda",
			products: [
				{
					name: "Chocolate",
					price: 6000,
					cost: 1800,
					art: "chocolate",
					unit: "แก้ว",
					groups: ["size", "sweet"],
				},
				{
					name: "Orange Juice",
					price: 5500,
					cost: 2000,
					art: "juice",
					unit: "ขวด",
					stock: 24,
				},
			],
		},
	],
};

const SPICE: SampleGroup = {
	key: "spice",
	name: "ความเผ็ด",
	selection: ModifierSelection.SINGLE,
	required: true,
	options: [
		{ name: "ไม่เผ็ด", priceDelta: 0 },
		{ name: "เผ็ดน้อย", priceDelta: 0 },
		{ name: "เผ็ดกลาง", priceDelta: 0, isDefault: true },
		{ name: "เผ็ดมาก", priceDelta: 0 },
	],
};

const MEAT: SampleGroup = {
	key: "meat",
	name: "เนื้อสัตว์",
	selection: ModifierSelection.SINGLE,
	required: true,
	options: [
		{ name: "หมูสับ", priceDelta: 0, isDefault: true },
		{ name: "ไก่", priceDelta: 0 },
		{ name: "หมูกรอบ", priceDelta: 1000, costDelta: 600 },
		{ name: "กุ้ง", priceDelta: 2000, costDelta: 1200 },
	],
};

const TOPPING: SampleGroup = {
	key: "topping",
	name: "เพิ่มเติม",
	selection: ModifierSelection.MULTIPLE,
	required: false,
	options: [
		{ name: "ไข่ดาว", priceDelta: 1000, costDelta: 450 },
		{ name: "ไข่เจียว", priceDelta: 1000, costDelta: 450 },
		{ name: "พิเศษ", priceDelta: 1500, costDelta: 800 },
	],
};

/** A Thai made-to-order kitchen: rice and noodle dishes, a soup, a salad, and drinks. */
const RESTAURANT: SampleCatalog = {
	groups: [MEAT, SPICE, TOPPING],
	categories: [
		{
			name: "อาหารจานเดียว",
			icon: "utensils",
			products: [
				{
					name: "ข้าวกะเพรา",
					price: 6000,
					cost: 2500,
					art: "rice",
					unit: "จาน",
					groups: ["meat", "spice", "topping"],
				},
				{
					name: "ข้าวผัด",
					price: 6000,
					cost: 2300,
					art: "rice",
					unit: "จาน",
					groups: ["meat", "topping"],
				},
				{ name: "ข้าวไข่เจียวหมูสับ", price: 5000, cost: 1800, art: "egg", unit: "จาน" },
			],
		},
		{
			name: "เส้น",
			icon: "utensils",
			products: [
				{
					name: "ผัดไทยกุ้งสด",
					price: 7000,
					cost: 3000,
					art: "noodle",
					unit: "จาน",
					groups: ["topping"],
				},
				{
					name: "ผัดซีอิ๊ว",
					price: 6000,
					cost: 2300,
					art: "noodle",
					unit: "จาน",
					groups: ["meat", "topping"],
				},
			],
		},
		{
			name: "ต้ม & ยำ",
			icon: "utensils",
			products: [
				{
					name: "ต้มยำกุ้ง",
					price: 12_000,
					cost: 5500,
					art: "soup",
					unit: "ถ้วย",
					groups: ["spice"],
				},
				{
					name: "ส้มตำไทย",
					price: 5000,
					cost: 1800,
					art: "salad",
					unit: "จาน",
					groups: ["spice"],
				},
			],
		},
		{
			name: "เครื่องดื่ม",
			icon: "cup-soda",
			products: [
				{ name: "ชาเย็น", price: 3500, cost: 1000, art: "tea", unit: "แก้ว" },
				{
					name: "น้ำเปล่า",
					price: 1500,
					cost: 500,
					art: "bottle",
					unit: "ขวด",
					stock: 48,
				},
			],
		},
	],
};

/** A neighbourhood minimart: everything counted on the shelf, in the unit it is sold in. */
const RETAIL: SampleCatalog = {
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
					stock: 120,
				},
				{
					name: "โค้ก 325ml",
					price: 1700,
					cost: 1200,
					art: "juice",
					unit: "กระป๋อง",
					stock: 48,
				},
				{
					name: "นมจืด UHT",
					price: 1500,
					cost: 1100,
					art: "milk",
					unit: "กล่อง",
					stock: 36,
				},
			],
		},
		{
			name: "ของกิน",
			icon: "package",
			products: [
				{
					name: "บะหมี่กึ่งสำเร็จรูป",
					price: 700,
					cost: 500,
					art: "noodle",
					unit: "ซอง",
					stock: 60,
				},
				{
					name: "ขนมปังแซนด์วิช",
					price: 2500,
					cost: 1600,
					art: "bread",
					unit: "ชิ้น",
					stock: 20,
				},
				{
					name: "มันฝรั่งทอด",
					price: 2000,
					cost: 1300,
					art: "snack",
					unit: "ห่อ",
					stock: 30,
				},
				{
					name: "ไข่ไก่ (แผง 10 ฟอง)",
					price: 5500,
					cost: 4200,
					art: "egg",
					unit: "แผง",
					stock: 12,
				},
			],
		},
		{
			name: "ของใช้",
			icon: "package",
			products: [
				{
					name: "สบู่ก้อน",
					price: 1500,
					cost: 900,
					art: "household",
					unit: "ก้อน",
					stock: 24,
				},
				{
					name: "ทิชชู่ม้วน",
					price: 2900,
					cost: 2000,
					art: "household",
					unit: "แพ็ก",
					stock: 20,
				},
			],
		},
	],
};

/** A salon: services by the job, and a few retail products on the counter. */
const SERVICE: SampleCatalog = {
	groups: [],
	categories: [
		{
			name: "บริการ",
			icon: "scissors",
			products: [
				{ name: "ตัดผมชาย", price: 15_000, cost: 0, art: "service", unit: "ครั้ง" },
				{ name: "ตัดผมหญิง", price: 25_000, cost: 0, art: "service", unit: "ครั้ง" },
				{ name: "สระ-ไดร์", price: 20_000, cost: 3000, art: "service", unit: "ครั้ง" },
				{ name: "ทำสีผม", price: 90_000, cost: 30_000, art: "service", unit: "ครั้ง" },
			],
		},
		{
			name: "สินค้า",
			icon: "package",
			products: [
				{
					name: "แชมพู",
					price: 25_000,
					cost: 15_000,
					art: "household",
					unit: "ขวด",
					stock: 10,
				},
				{
					name: "ทรีตเมนต์",
					price: 32_000,
					cost: 19_000,
					art: "household",
					unit: "ขวด",
					stock: 8,
				},
			],
		},
	],
};

const GENERIC: SampleCatalog = {
	groups: [],
	categories: [
		{
			name: "สินค้าทั่วไป",
			icon: "package",
			products: [
				{
					name: "Mineral Water",
					price: 2000,
					cost: 700,
					art: "bottle",
					unit: "ขวด",
					stock: 48,
				},
				{
					name: "Cookie",
					price: 4500,
					cost: 1200,
					art: "cookie",
					unit: "ชิ้น",
					stock: 20,
				},
			],
		},
	],
};

export const SAMPLE_CATALOGS: Record<BusinessType, SampleCatalog> = {
	[BusinessType.CAFE]: CAFE,
	[BusinessType.RESTAURANT]: RESTAURANT,
	[BusinessType.BEVERAGE]: BEVERAGE,
	[BusinessType.BAKERY]: BAKERY,
	[BusinessType.RETAIL]: RETAIL,
	[BusinessType.SERVICE]: SERVICE,
	[BusinessType.OTHER]: GENERIC,
};

/** What onboarding shows before the shop exists: category and product names, with prices. */
export const samplePreview = (type: BusinessType) =>
	SAMPLE_CATALOGS[type].categories.map((c) => ({
		name: c.name,
		products: c.products.map((p) => ({ name: p.name, price: p.price, art: p.art })),
	}));
