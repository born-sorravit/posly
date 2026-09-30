"use client";

import { signOut } from "@/components/shell/app-shell";
import { Button } from "@posly/ui/components/button";
import { KeyRound, ShieldX } from "lucide-react";

export function NoAccess({ email, reason = "not-admin" }: { email: string; reason?: "not-admin" | "google" }) {
	const google = reason === "google";
	return (
		<div className="flex min-h-svh items-center justify-center px-4">
			<div className="surface grid w-full max-w-md justify-items-center gap-4 rounded-2xl p-8 text-center">
				<span className="flex size-14 items-center justify-center rounded-2xl bg-danger/10 text-danger">
					{google ? <KeyRound className="size-6" aria-hidden /> : <ShieldX className="size-6" aria-hidden />}
				</span>
				<div className="grid gap-1">
					<h1 className="font-semibold text-xl">{google ? "ต้องเข้าสู่ระบบด้วย Google" : "ไม่มีสิทธิ์เข้าถึง"}</h1>
					<p className="text-muted-foreground text-sm">
						{google ? (
							<>
								บัญชีผู้ดูแลเข้าหน้านี้ได้เฉพาะเมื่อเข้าสู่ระบบด้วย Google ออกจากระบบแล้วกด “เข้าสู่ระบบด้วย Google” ด้วย{" "}
								<span className="font-medium text-foreground">{email}</span>
							</>
						) : (
							<>
								บัญชี <span className="font-medium text-foreground">{email}</span> ไม่ใช่ผู้ดูแลแพลตฟอร์ม
							</>
						)}
					</p>
				</div>
				<Button variant="outline" size="lg" className="h-11 w-full tablet:h-9 tablet:w-auto" onClick={signOut}>
					{google ? "ออกจากระบบแล้วเข้าด้วย Google" : "ออกจากระบบแล้วใช้บัญชีอื่น"}
				</Button>
			</div>
		</div>
	);
}
