import { InventoryView } from "@/components/catalog/inventory-view";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("nav");
	return { title: t("inventory") };
}

export default function Page() {
	return <InventoryView />;
}
