import { AttentionView } from "@/components/views/attention";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "ต้องดูแล" };

export default function Page() {
	return <AttentionView />;
}
