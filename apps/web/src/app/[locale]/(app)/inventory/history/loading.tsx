import { StockHistorySkeleton } from "@/components/catalog/inventory-skeletons";

/** Keeps the history page (no tabs, no counts) off the stock page's skeleton one level up. */
export default function Loading() {
	return <StockHistorySkeleton />;
}
