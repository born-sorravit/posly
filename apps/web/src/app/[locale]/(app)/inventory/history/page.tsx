import { StockHistoryView } from "@/components/catalog/stock-history-view";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("inventory");
	return { title: t("historyTitle") };
}

export default function Page() {
	return <StockHistoryView />;
}
