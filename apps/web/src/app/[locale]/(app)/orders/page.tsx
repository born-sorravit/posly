import { OrdersView } from "@/components/orders/orders-view";
import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("nav");
	return { title: t("orders") };
}

export default function Page() {
	return (
		// OrdersView reads ?search= from the command menu.
		<Suspense>
			<OrdersView />
		</Suspense>
	);
}
