import { AcceptInvite } from "@/components/invite/accept-invite";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("invite");
	// An invite link must never end up in a search index.
	return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
	const { token } = await params;
	return <AcceptInvite token={token} />;
}
