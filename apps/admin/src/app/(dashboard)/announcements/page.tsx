import { AnnouncementsView } from "@/components/views/announcements";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "ประกาศ" };

export default function Page() {
	return <AnnouncementsView />;
}
