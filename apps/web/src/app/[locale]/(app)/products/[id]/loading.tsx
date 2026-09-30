import { ProductFormSkeleton } from "@/components/products/products-skeletons";

/** Keeps the product editor off the product table's skeleton one level up. */
export default function Loading() {
	return <ProductFormSkeleton edit />;
}
