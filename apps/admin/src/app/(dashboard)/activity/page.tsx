import { ActivityView } from "@/components/views/activity";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "กิจกรรม" };

export default function Page() {
	return <ActivityView />;
}
