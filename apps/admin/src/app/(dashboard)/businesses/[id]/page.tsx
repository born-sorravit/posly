import { BusinessDetailView } from "@/components/views/business-detail";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "รายละเอียดร้าน" };

export default async function BusinessDetailPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	return <BusinessDetailView id={id} />;
}
