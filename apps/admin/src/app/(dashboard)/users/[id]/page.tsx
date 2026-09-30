import { UserDetailView } from "@/components/views/user-detail";
import { getCurrentUser } from "@/lib/auth/session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "รายละเอียดผู้ใช้" };

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	// Only to warn an admin that signing this account out includes their own session.
	const me = await getCurrentUser();
	return <UserDetailView id={id} currentUserId={me?.id ?? null} />;
}
