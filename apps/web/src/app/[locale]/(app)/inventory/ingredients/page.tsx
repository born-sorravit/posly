import { IngredientsView } from "@/components/catalog/ingredients-view";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("ingredients");
	return { title: t("title") };
}

export default function Page() {
	return <IngredientsView />;
}
