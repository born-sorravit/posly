import { Brand } from "@/components/layout/brand";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

/** Centred card, no app shell. A soft brand wash stands in for a marketing panel. */
export default async function AuthLayout({ children }: { children: ReactNode }) {
	const t = await getTranslations("auth");
	return (
		<div
			className="flex min-h-svh flex-col items-center justify-center gap-8 px-4 py-12"
			style={{
				backgroundImage:
					"radial-gradient(ellipse 60% 50% at 50% -10%, color-mix(in oklab, var(--primary) 14%, transparent), transparent 70%)",
			}}
		>
			<Brand size="lg" />
			<div className="w-full max-w-sm surface rounded-3xl p-6 tablet:p-8">
				{children}
			</div>
			<p className="text-muted-foreground text-xs">{t("tagline")}</p>
		</div>
	);
}
