import "@/app/globals.css";
import { Providers } from "@/components/providers/providers";
import { routing } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/session";
import { fontVariables } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

export function generateStaticParams() {
	return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ locale: string }>;
}): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale: locale as "th", namespace: "app" });

	return {
		title: { default: t("name"), template: `%s · ${t("name")}` },
		description: t("description"),
		applicationName: t("name"),
		appleWebApp: { capable: true, title: t("name"), statusBarStyle: "default" },
		// Setting `icons` at all replaces the file-convention `app/icon.png`, so the tab icon
		// has to be listed here too — without it the page has no favicon.
		// iOS ignores the manifest's icons and wants its own, full-bleed.
		icons: {
			icon: [{ url: "/icon.png", type: "image/png", sizes: "256x256" }],
			apple: "/icons/apple-touch-icon.png",
		},
	};
}

/** A POS is used standing up, one-handed: no pinch-zoom surprises, and the notch respected. */
export const viewport: Viewport = {
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#f8f9fc" },
		{ media: "(prefers-color-scheme: dark)", color: "#0b1120" },
	],
	width: "device-width",
	initialScale: 1,
	viewportFit: "cover",
};

export default async function LocaleLayout({
	children,
	params,
}: {
	children: ReactNode;
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	if (!hasLocale(routing.locales, locale)) {
		notFound();
	}

	setRequestLocale(locale);

	// Read once here and handed to every client component, so nothing renders signed out for a
	// frame before discovering there is a session. The proxy has already refreshed a stale
	// token by this point.
	const user = await getCurrentUser().catch(() => null);

	return (
		<html
			lang={locale}
			suppressHydrationWarning
			className={cn(fontVariables, "h-full antialiased")}
		>
			<body className="flex min-h-full flex-col">
				<NextIntlClientProvider>
					<Providers initialUser={user}>{children}</Providers>
				</NextIntlClientProvider>
			</body>
		</html>
	);
}
