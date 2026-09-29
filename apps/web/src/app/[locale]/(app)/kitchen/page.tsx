import { KitchenView } from "@/components/kitchen/kitchen-view";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("nav");
	return { title: t("kitchen") };
}

export default function Page() {
	return <KitchenView />;
}
