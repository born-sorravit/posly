import { ForgotPasswordSoon } from "@/components/auth/password-reset";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("auth");
	return { title: t("forgotTitle") };
}

/** Reset by email is not open yet; swap back to <ForgotPasswordForm /> once mail is configured. */
export default function Page() {
	return <ForgotPasswordSoon />;
}
