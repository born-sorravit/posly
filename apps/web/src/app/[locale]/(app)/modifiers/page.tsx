import { ModifiersView } from "@/components/catalog/modifiers-view";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("nav");
	return { title: t("modifiers") };
}

export default function Page() {
	return <ModifiersView />;
}
