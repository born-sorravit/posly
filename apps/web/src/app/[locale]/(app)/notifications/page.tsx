import { PageContainer, PageHeader, Surface } from "@/components/common/primitives";
import { MarkAllReadButton, NotificationList } from "@/components/layout/notifications-button";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("notifications");
	return { title: t("title") };
}

/** The phone's bell tab; on wider screens the same list lives in the header popover. */
export default async function NotificationsPage() {
	const t = await getTranslations("notifications");
	return (
		<PageContainer className="max-w-2xl">
			<PageHeader title={t("title")} actions={<MarkAllReadButton />} />
			<Surface className="p-2">
				<NotificationList />
			</Surface>
		</PageContainer>
	);
}
