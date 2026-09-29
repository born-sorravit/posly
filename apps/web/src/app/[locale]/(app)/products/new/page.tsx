import { ProductFormPage } from "@/components/products/product-form";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("productForm");
	return { title: t("newTitle") };
}

export default function Page() {
	return <ProductFormPage />;
}
