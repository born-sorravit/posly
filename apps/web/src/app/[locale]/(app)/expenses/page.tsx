import { ExpensesView } from "@/components/expenses/expenses-view";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("nav");
	return { title: t("expenses") };
}

export default function Page() {
	return <ExpensesView />;
}
