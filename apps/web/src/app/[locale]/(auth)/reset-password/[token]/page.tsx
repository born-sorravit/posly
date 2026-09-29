import { ResetPasswordForm } from "@/components/auth/password-reset";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("auth");
	return { title: t("resetTitle"), robots: { index: false } };
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
	const { token } = await params;
	return <ResetPasswordForm token={token} />;
}
