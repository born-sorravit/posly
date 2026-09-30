"use client";

import { useAdminAction } from "@/lib/admin-api";
import { Button } from "@posly/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@posly/ui/components/dialog";
import { Input } from "@posly/ui/components/input";
import { Label } from "@posly/ui/components/label";
import { LoaderCircle, LogOut } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

/** Ends every signed-in device of one account. */
export function RevokeSessionsDialog({
	userId,
	email,
	sessions,
	isSelf,
}: {
	userId: string;
	email: string;
	sessions: number;
	isSelf: boolean;
}) {
	const [open, setOpen] = useState(false);
	const [note, setNote] = useState("");
	const action = useAdminAction<{ note?: string }, { revoked: number }>(`users/${userId}/sessions/revoke`);

	const submit = (event: FormEvent) => {
		event.preventDefault();
		action.mutate(
			{ note: note.trim() || undefined },
			{
				onSuccess: ({ revoked }) => {
					toast.success(`ออกจากระบบ ${revoked} อุปกรณ์แล้ว`);
					setOpen(false);
					// Signing yourself out ends this session too, on its next refresh.
					if (isSelf) window.location.reload();
				},
				onError: (error) => toast.error(error.message),
			}
		);
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (next) setNote("");
			}}
		>
			<DialogTrigger asChild>
				<Button variant="outline" size="lg" disabled={sessions === 0}>
					<LogOut />
					ออกจากระบบทุกอุปกรณ์
				</Button>
			</DialogTrigger>
			<DialogContent className="gap-6 p-6 sm:max-w-md">
				<DialogHeader>
					<DialogTitle>ออกจากระบบทุกอุปกรณ์?</DialogTitle>
					<DialogDescription>
						{email} จะต้องเข้าสู่ระบบใหม่ในทุกอุปกรณ์ ({sessions} อุปกรณ์) อุปกรณ์ที่เปิดอยู่ใช้งานต่อได้อีกไม่เกิน 15 นาทีจนกว่า token ปัจจุบันจะหมดอายุ
						{isSelf ? " นี่คือบัญชีของคุณเอง คุณจะถูกออกจากระบบด้วย" : ""}
					</DialogDescription>
				</DialogHeader>
				<form id="revoke-sessions" onSubmit={submit} className="grid gap-2">
					<Label htmlFor="revoke-note">เหตุผล (ไม่บังคับ)</Label>
					<Input
						id="revoke-note"
						value={note}
						maxLength={200}
						onChange={(e) => setNote(e.target.value)}
						placeholder="เช่น ทำโทรศัพท์หาย"
						className="h-11"
					/>
				</form>
				<DialogFooter>
					<Button variant="outline" size="lg" className="h-11 tablet:h-9" onClick={() => setOpen(false)}>
						ยกเลิก
					</Button>
					<Button type="submit" form="revoke-sessions" variant="destructive" size="lg" className="h-11 tablet:h-9" disabled={action.isPending}>
						{action.isPending ? <LoaderCircle className="animate-spin" /> : null}
						ออกจากระบบทุกอุปกรณ์
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
