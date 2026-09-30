import { SubscriptionsView } from "@/components/views/subscriptions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Subscriptions" };

export default function Page() {
	return <SubscriptionsView />;
}
