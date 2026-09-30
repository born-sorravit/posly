import { OverviewView } from "@/components/views/overview";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "ภาพรวม" };

export default function OverviewPage() {
	return <OverviewView />;
}
