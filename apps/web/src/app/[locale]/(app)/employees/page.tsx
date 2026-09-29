import { EmployeesView } from "@/components/people/people-views";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("nav");
	return { title: t("employees") };
}

export default function Page() {
	return <EmployeesView />;
}
