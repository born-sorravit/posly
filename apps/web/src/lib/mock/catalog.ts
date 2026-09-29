import type { Category, ModifierGroup, Product } from "@posly/types/domain";

/**
 * Mock catalogue for validating the UX before the API exists (plan §48). Prices are satang,
 * exactly as the API will send them, so swapping this for a query changes no component.
 */

const size: ModifierGroup = {
	id: "mg-size",
	name: "ขนาด",
	selection: "SINGLE",
	required: true,
	defaultOptionId: "mo-size-m",
	options: [
		{ id: "mo-size-s", name: "S", priceDelta: 0 },
		{ id: "mo-size-m", name: "M", priceDelta: 1000 },
		{ id: "mo-size-l", name: "L", priceDelta: 2000 },
	],
};

const sweetness: ModifierGroup = {
	id: "mg-sweet",
	name: "ความหวาน",
	selection: "SINGLE",
	required: true,
	defaultOptionId: "mo-sweet-50",
	options: [
		{ id: "mo-sweet-0", name: "0%", priceDelta: 0 },
		{ id: "mo-sweet-25", name: "25%", priceDelta: 0 },
		{ id: "mo-sweet-50", name: "50%", priceDelta: 0 },
		{ id: "mo-sweet-75", name: "75%", priceDelta: 0 },
		{ id: "mo-sweet-100", name: "100%", priceDelta: 0 },
	],
};

const extras: ModifierGroup = {
	id: "mg-extra",
	name: "เพิ่มเติม",
	selection: "MULTIPLE",
	required: false,
	options: [
		{ id: "mo-extra-shot", name: "Extra Shot", priceDelta: 1500 },
		{ id: "mo-extra-oat", name: "Oat Milk", priceDelta: 2000 },
	],
};

const DRINK = [size, sweetness, extras];
const TEA = [size, sweetness];

export const CATEGORIES: Category[] = [
	{ id: "cat-coffee", name: "กาแฟ", icon: "coffee", displayOrder: 1, isActive: true, sendToKitchen: true, productCount: 4 },
	{ id: "cat-tea", name: "ชา", icon: "leaf", displayOrder: 2, isActive: true, sendToKitchen: true, productCount: 3 },
	{ id: "cat-milk", name: "นม", icon: "milk", displayOrder: 3, isActive: true, sendToKitchen: true, productCount: 1 },
	{ id: "cat-drink", name: "เครื่องดื่ม", icon: "cup-soda", displayOrder: 4, isActive: true, sendToKitchen: true, productCount: 2 },
	{ id: "cat-bakery", name: "ขนม", icon: "croissant", displayOrder: 5, isActive: true, sendToKitchen: true, productCount: 4 },
	{ id: "cat-food", name: "อาหาร", icon: "utensils", displayOrder: 6, isActive: true, sendToKitchen: true, productCount: 0 },
	{ id: "cat-other", name: "อื่นๆ", icon: "package", displayOrder: 7, isActive: false, sendToKitchen: true, productCount: 0 },
];

const product = (
	p: Partial<Product> & Pick<Product, "id" | "name" | "categoryId" | "price" | "art">
): Product => ({
	cost: null,
	sku: null,
	barcode: null,
	imageUrl: null,
	trackStock: false,
	stock: null,
	lowStockAt: null,
	unit: "แก้ว",
	isActive: true,
	modifierGroups: [],
	...p,
});

export const PRODUCTS: Product[] = [
	product({ id: "p-americano", name: "Americano", categoryId: "cat-coffee", price: 6000, cost: 1800, sku: "CF-001", art: "coffee", modifierGroups: DRINK }),
	product({ id: "p-latte", name: "Latte", categoryId: "cat-coffee", price: 7000, cost: 2200, sku: "CF-002", art: "latte", modifierGroups: DRINK }),
	product({ id: "p-cappuccino", name: "Cappuccino", categoryId: "cat-coffee", price: 7000, cost: 2200, sku: "CF-003", art: "latte", modifierGroups: DRINK }),
	product({ id: "p-mocha", name: "Mocha", categoryId: "cat-coffee", price: 7500, cost: 2600, sku: "CF-004", art: "chocolate", modifierGroups: DRINK }),
	product({ id: "p-matcha", name: "Matcha Latte", categoryId: "cat-tea", price: 7000, cost: 2500, sku: "TE-001", art: "matcha", modifierGroups: TEA, trackStock: true, stock: 5, lowStockAt: 10, unit: "แก้ว" }),
	product({ id: "p-thai-tea", name: "Thai Tea", categoryId: "cat-tea", price: 6500, cost: 1700, sku: "TE-002", art: "tea", modifierGroups: TEA }),
	product({ id: "p-green-tea", name: "Green Tea", categoryId: "cat-tea", price: 6000, cost: 1600, sku: "TE-003", art: "matcha", modifierGroups: TEA }),
	product({ id: "p-chocolate", name: "Chocolate", categoryId: "cat-milk", price: 6500, cost: 2000, sku: "MK-001", art: "chocolate", modifierGroups: TEA }),
	product({ id: "p-orange", name: "Orange Juice", categoryId: "cat-drink", price: 5500, cost: 2000, sku: "DR-001", art: "juice", trackStock: true, stock: 0, lowStockAt: 5, unit: "ขวด" }),
	product({ id: "p-water", name: "Mineral Water", categoryId: "cat-drink", price: 2000, cost: 700, sku: "DR-002", art: "bottle", trackStock: true, stock: 48, lowStockAt: 12, unit: "ขวด" }),
	product({ id: "p-croissant", name: "Croissant", categoryId: "cat-bakery", price: 6500, cost: 2400, sku: "BK-001", art: "croissant", trackStock: true, stock: 12, lowStockAt: 4, unit: "ชิ้น" }),
	product({ id: "p-cheesecake", name: "Cheesecake", categoryId: "cat-bakery", price: 8000, cost: 3000, sku: "BK-002", art: "cake", trackStock: true, stock: 3, lowStockAt: 4, unit: "ชิ้น" }),
	product({ id: "p-brownie", name: "Brownie", categoryId: "cat-bakery", price: 7200, cost: 2500, sku: "BK-003", art: "brownie", trackStock: true, stock: 9, lowStockAt: 4, unit: "ชิ้น" }),
	product({ id: "p-cookie", name: "Cookie", categoryId: "cat-bakery", price: 4500, cost: 1200, sku: "BK-004", art: "cookie", trackStock: true, stock: 20, lowStockAt: 6, unit: "ชิ้น" }),
];

