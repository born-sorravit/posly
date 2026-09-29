import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { requireUser } from "@/lib/auth/require-user";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("onboarding");
	return { title: t("welcomeTitle") };
}

/** Also reached from the store switcher's "new store", so it does not bounce existing owners. */
export default async function OnboardingPage() {
	await requireUser("/onboarding");
	return <OnboardingFlow />;
}
