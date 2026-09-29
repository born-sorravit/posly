import { ReportsView } from "@/components/reports/reports-view";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("nav");
	return { title: t("reports") };
}

export default function Page() {
	return <ReportsView />;
}
