import { CategoriesView } from "@/components/catalog/categories-view";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("nav");
	return { title: t("categories") };
}

export default function Page() {
	return <CategoriesView />;
}
