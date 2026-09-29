import { LandingPage } from "@/components/landing/landing-page";
import { getCurrentUser } from "@/lib/auth/session";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("landing");
	return { title: { absolute: t("metaTitle") }, description: t("metaDescription") };
}

/**
 * The public front page. Signed-in visitors still see it (a shared link should show what
 * Posly is), with the sign-up buttons turned into "ไปที่ร้านของฉัน".
 */
export default async function IndexPage() {
	const user = await getCurrentUser().catch(() => null);
	return <LandingPage signedIn={Boolean(user)} />;
}
