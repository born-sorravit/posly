import type { Product, StockStatus } from "@posly/types/domain";

/** In stock / low / out, from the product's own threshold. Untracked products have no status. */
export const stockStatus = (p: Pick<Product, "trackStock" | "stock" | "lowStockAt">): StockStatus => {
	if (!p.trackStock || p.stock === null) return "UNTRACKED";
	if (p.stock <= 0) return "OUT_OF_STOCK";
	if (p.lowStockAt !== null && p.stock <= p.lowStockAt) return "LOW_STOCK";
	return "IN_STOCK";
};
