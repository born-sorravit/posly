import { TablesView } from "@/components/tables/tables-view";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("nav");
	return { title: t("tables") };
}

export default function Page() {
	// The open tab lives in `?tab=`, read on the client.
	return (
		<Suspense>
			<TablesView />
		</Suspense>
	);
}
