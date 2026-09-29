import { ProfileView } from "@/components/profile/profile-view";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("profile");
	return { title: t("title") };
}

export default function Page() {
	return <ProfileView />;
}
