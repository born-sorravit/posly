import { UsersView } from "@/components/views/users";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "ผู้ใช้" };

export default function Page() {
	return <UsersView />;
}
