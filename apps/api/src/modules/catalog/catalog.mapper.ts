import type { ModifierGroup } from "@/models/catalog/entities/modifier-group.entity";
import type { Product } from "@/models/catalog/entities/product.entity";
import type {
	ModifierGroupResponse,
	ProductResponse,
} from "@/modules/catalog/dto/catalog.dto";

export const toModifierGroupResponse = (
	group: ModifierGroup
): ModifierGroupResponse => {
	const options = [...(group.options ?? [])].sort(
		(a, b) => a.displayOrder - b.displayOrder
	);
	return {
		id: group.id,
		name: group.name,
		selection: group.selection,
		required: group.required,
		options: options.map((o) => ({
			id: o.id,
			name: o.name,
			priceDelta: o.priceDelta,
			costDelta: o.costDelta,
			isDefault: o.isDefault,
		})),
		defaultOptionId: options.find((o) => o.isDefault)?.id ?? null,
	};
};

/** The group as a cashier may see it: without what each option costs the shop. */
export const withoutModifierCost = <T extends ModifierGroupResponse>(
	group: T
): T => ({
	...group,
	options: group.options.map((o) => ({ ...o, costDelta: null })),
});

export const toProductResponse = (
	product: Product,
	publicUrl: (path: string) => string
): ProductResponse => ({
	id: product.id,
	name: product.name,
	categoryId: product.categoryId,
	price: product.price,
	cost: product.cost,
	sku: product.sku,
	barcode: product.barcode,
	art: product.art,
	imagePath: product.imagePath,
	imageUrl: product.imagePath ? publicUrl(product.imagePath) : null,
	trackStock: product.trackStock,
	stock: product.stock,
	lowStockAt: product.lowStockAt,
	unit: product.unit,
	isActive: product.isActive,
	modifierGroups: [...(product.modifierGroups ?? [])]
		.sort((a, b) => a.displayOrder - b.displayOrder)
		.map(toModifierGroupResponse),
});
