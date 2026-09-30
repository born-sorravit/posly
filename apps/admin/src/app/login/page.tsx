import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth/session";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

export default async function LoginPage() {
	const user = await getCurrentUser();
	if (user?.isPlatformAdmin) redirect("/");
	return <LoginForm />;
}
