import { SystemView } from "@/components/views/system";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "ระบบ" };

export default function Page() {
	return <SystemView />;
}
