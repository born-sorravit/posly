import { CustomersView } from "@/components/people/customers-view";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("nav");
	return { title: t("customers") };
}

export default function Page() {
	return <CustomersView />;
}
