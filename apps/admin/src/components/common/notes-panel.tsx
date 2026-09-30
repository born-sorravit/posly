"use client";

import { SectionTitle, Surface } from "@/components/common/primitives";
import { useAdminUser } from "@/components/shell/admin-user";
import { useAdmin, useAdminAction } from "@/lib/admin-api";
import type { AdminNoteRow } from "@/lib/types";
import { Button } from "@posly/ui/components/button";
import { Textarea } from "@posly/ui/components/textarea";
import { formatDateTime } from "@posly/utils/format";
import { LoaderCircle, StickyNote, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

const MAX = 2000;

/**
 * The support team's notes on one shop or account: what was agreed on a call, why a trial
 * was extended. Every admin reads them; only the author can remove one.
 */
export function NotesPanel({ targetType, targetId }: { targetType: "business" | "user"; targetId: string }) {
	const me = useAdminUser();
	const [body, setBody] = useState("");
	const notes = useAdmin<AdminNoteRow[]>("notes", { targetType, targetId }, 0);
	const create = useAdminAction<{ targetType: string; targetId: string; body: string }, AdminNoteRow>("notes");
	const remove = useAdminAction<{ id: string }, void>(({ id }) => `notes/${id}`, "DELETE");

	const submit = (event: FormEvent) => {
		event.preventDefault();
		if (!body.trim()) return;
		create.mutate(
			{ targetType, targetId, body },
			{
				onSuccess: () => {
					setBody("");
					toast.success("บันทึกแล้ว");
				},
				onError: (error) => toast.error(error.message),
			}
		);
	};

	return (
		<Surface>
			<SectionTitle title="บันทึกของทีม" hint="ผู้ดูแลทุกคนเห็น ลบได้เฉพาะบันทึกของตัวเอง" />
			<form onSubmit={submit} className="grid gap-2 px-5 pb-4">
				<Textarea
					id={`note-${targetId}`}
					value={body}
					maxLength={MAX}
					onChange={(e) => setBody(e.target.value)}
					onKeyDown={(e) => {
						// ⌘/Ctrl+Enter saves, as in most note boxes.
						if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
					}}
					placeholder="เช่น โทรคุยแล้ว ขอขยายช่วงทดลองใช้อีก 14 วัน"
					className="min-h-20 rounded-xl"
				/>
				<div className="flex items-center justify-between gap-3">
					<span className="numeric text-muted-foreground text-xs">
						{body.length ? `${body.length}/${MAX}` : "⌘ Enter เพื่อบันทึก"}
					</span>
					<Button
						type="submit"
						size="lg"
						className="brand-gradient h-11 tablet:h-9"
						disabled={!body.trim() || create.isPending}
					>
						{create.isPending ? <LoaderCircle className="animate-spin" /> : null}
						บันทึก
					</Button>
				</div>
			</form>

			{notes.data && notes.data.length > 0 ? (
				<ul className="divide-y border-t">
					<AnimatePresence initial={false}>
					{notes.data.map((note) => (
						<motion.li
							key={note.id}
							layout
							initial={{ opacity: 0, y: -6 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, x: 24, transition: { duration: 0.15 } }}
							transition={{ duration: 0.18 }}
							className="flex gap-3 px-5 py-3"
						>
							<StickyNote className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
							<div className="min-w-0 flex-1">
								<p className="whitespace-pre-wrap break-words text-sm">{note.body}</p>
								<p className="mt-1 text-muted-foreground text-xs">
									{note.adminEmail} · {formatDateTime(note.createdAt)}
								</p>
							</div>
							{note.adminUserId === me?.id ? (
								<Button
									variant="ghost"
									size="icon-sm"
									aria-label="ลบบันทึก"
									className="text-muted-foreground hover:text-danger"
									disabled={remove.isPending}
									onClick={() =>
										remove.mutate(
											{ id: note.id },
											{ onSuccess: () => toast.success("ลบบันทึกแล้ว"), onError: (e) => toast.error(e.message) }
										)
									}
								>
									<Trash2 />
								</Button>
							) : null}
						</motion.li>
					))}
					</AnimatePresence>
				</ul>
			) : notes.data ? (
				<p className="border-t px-5 py-4 text-muted-foreground text-sm">ยังไม่มีบันทึก</p>
			) : null}
		</Surface>
	);
}
