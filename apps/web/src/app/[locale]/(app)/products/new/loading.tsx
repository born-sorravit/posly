import { ProductFormSkeleton } from "@/components/products/products-skeletons";

/** Keeps the new-product form off the product table's skeleton one level up. */
export default function Loading() {
	return <ProductFormSkeleton />;
}
