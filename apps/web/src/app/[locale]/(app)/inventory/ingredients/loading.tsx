import { IngredientsSkeleton } from "@/components/catalog/inventory-skeletons";

/** Keeps the ingredients page off the stock page's skeleton one level up. */
export default function Loading() {
	return <IngredientsSkeleton />;
}
