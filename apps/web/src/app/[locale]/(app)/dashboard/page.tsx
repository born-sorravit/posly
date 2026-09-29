import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("nav");
	return { title: t("overview") };
}

export default function DashboardPage() {
	return <DashboardOverview />;
}
