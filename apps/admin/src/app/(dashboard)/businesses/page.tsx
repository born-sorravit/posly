import { BusinessesView } from "@/components/views/businesses";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "ร้านค้า" };

export default function BusinessesPage() {
	return <BusinessesView />;
}
