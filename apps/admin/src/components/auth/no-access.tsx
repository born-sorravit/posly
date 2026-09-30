"use client";

import { signOut } from "@/components/shell/app-shell";
import { Button } from "@posly/ui/components/button";
import { ShieldX } from "lucide-react";

export function NoAccess({ email }: { email: string }) {
	return (
		<div className="flex min-h-svh items-center justify-center px-4">
			<div className="surface grid w-full max-w-md justify-items-center gap-4 rounded-2xl p-8 text-center">
				<ShieldX className="size-10 text-destructive" aria-hidden />
				<div className="grid gap-1">
					<h1 className="font-semibold text-xl">ไม่มีสิทธิ์เข้าถึง</h1>
					<p className="text-muted-foreground text-sm">
						บัญชี <span className="font-medium text-foreground">{email}</span> ไม่ใช่ผู้ดูแลแพลตฟอร์ม
					</p>
				</div>
				<Button variant="outline" onClick={signOut}>
					ออกจากระบบแล้วใช้บัญชีอื่น
				</Button>
			</div>
		</div>
	);
}
