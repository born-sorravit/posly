import { GrowthView } from "@/components/views/growth";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "การเติบโต" };

export default function Page() {
	return <GrowthView />;
}
