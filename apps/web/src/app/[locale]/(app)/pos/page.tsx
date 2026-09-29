import { PosScreen } from "@/components/pos/pos-screen";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("nav");
	return { title: t("pos") };
}

export default function PosPage() {
	return <PosScreen />;
}
