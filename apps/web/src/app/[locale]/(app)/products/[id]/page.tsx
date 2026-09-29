import { ProductFormPage } from "@/components/products/product-form";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	return <ProductFormPage productId={id} />;
}
