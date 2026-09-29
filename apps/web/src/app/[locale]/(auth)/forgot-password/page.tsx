import { ForgotPasswordForm } from "@/components/auth/password-reset";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("auth");
	return { title: t("forgotTitle") };
}

export default function Page() {
	return <ForgotPasswordForm />;
}
