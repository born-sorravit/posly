"use client";

import { GoogleButton } from "@/components/auth/google-button";
import { Brand } from "@/components/shell/nav";
import { Button } from "@posly/ui/components/button";
import { Input } from "@posly/ui/components/input";
import { Label } from "@posly/ui/components/label";
import type { AuthUser } from "@posly/types/api";
import { LoaderCircle } from "lucide-react";
import { type FormEvent, useState } from "react";

/**
 * Signs in through our own route handlers, which keep the tokens in httpOnly cookies. The
 * dashboard layout then decides whether this account may see the monitor.
 */
export function LoginForm() {
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const finish = async (response: Response) => {
		const payload = (await response.json().catch(() => null)) as
			| { user?: AuthUser; message?: string }
			| null;
		if (!response.ok) {
			setError(response.status === 401 ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง" : (payload?.message ?? "เข้าสู่ระบบไม่สำเร็จ"));
			setPending(false);
			return;
		}
		// A full load on purpose: the server layout must re-read the session cookies.
		// eslint-disable-next-line @next/next/no-location-assign-relative-destination
		window.location.assign("/");
	};

	const submit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		setPending(true);
		setError(null);
		const response = await fetch("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
		}).catch(() => null);
		if (!response) {
			setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
			setPending(false);
			return;
		}
		await finish(response);
	};

	const google = async (idToken: string) => {
		setPending(true);
		setError(null);
		const response = await fetch("/api/auth/google", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ idToken }),
		}).catch(() => null);
		if (!response) {
			setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
			setPending(false);
			return;
		}
		await finish(response);
	};

	return (
		<div className="flex min-h-svh items-center justify-center px-4 py-10">
			<div className="surface grid w-full max-w-sm gap-6 rounded-2xl p-6 sm:p-8">
				<div className="grid gap-3">
					<Brand />
					<div>
						<h1 className="font-semibold text-xl">เข้าสู่ระบบผู้ดูแล</h1>
						<p className="text-muted-foreground text-sm">สำหรับผู้ดูแลแพลตฟอร์ม Posly เท่านั้น</p>
					</div>
				</div>

				<GoogleButton mode="login" label="เข้าสู่ระบบด้วย Google" onCredential={google} />

				<div className="flex items-center gap-3 text-muted-foreground text-xs">
					<span className="h-px flex-1 bg-border" />
					หรือ
					<span className="h-px flex-1 bg-border" />
				</div>

				<form onSubmit={submit} className="grid gap-4">
					<div className="grid gap-2">
						<Label htmlFor="email">อีเมล</Label>
						<Input id="email" name="email" type="email" autoComplete="email" required className="h-11" />
					</div>
					<div className="grid gap-2">
						<Label htmlFor="password">รหัสผ่าน</Label>
						<Input
							id="password"
							name="password"
							type="password"
							autoComplete="current-password"
							required
							className="h-11"
						/>
					</div>
					{error ? (
						<p role="alert" className="text-destructive text-sm">
							{error}
						</p>
					) : null}
					<Button type="submit" size="lg" className="h-11" disabled={pending}>
						{pending ? <LoaderCircle className="animate-spin" /> : null}
						เข้าสู่ระบบ
					</Button>
				</form>
			</div>
		</div>
	);
}
