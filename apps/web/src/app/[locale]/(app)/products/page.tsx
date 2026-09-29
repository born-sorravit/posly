import { ProductsView } from "@/components/products/products-view";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("nav");
	return { title: t("products") };
}

export default function Page() {
	return <ProductsView />;
}
