import { GuestOrder } from "@/components/guest/guest-order";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("guest");
	// A table's QR link opens that table: it must never end up in a search index.
	return { title: t("title"), robots: { index: false, follow: false } };
}

/** The page behind a table's QR code. */
export default async function GuestTablePage({ params }: { params: Promise<{ token: string }> }) {
	const { token } = await params;
	return <GuestOrder token={token} />;
}
