import { AuthForm } from "@/components/auth/auth-form";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("auth");
	return { title: t("registerTitle") };
}

export default async function Page() {
	const t = await getTranslations("auth");
	return (
		<div className="space-y-6">
			<div className="space-y-1 text-center">
				<h1 className="font-semibold text-2xl tracking-tight">{t("registerTitle")}</h1>
				<p className="text-muted-foreground text-sm">{t("registerHint")}</p>
			</div>
			{/* AuthForm reads useSearchParams for ?next=, which opts it out of prerendering. */}
			<Suspense>
				<AuthForm mode="register" />
			</Suspense>
		</div>
	);
}
