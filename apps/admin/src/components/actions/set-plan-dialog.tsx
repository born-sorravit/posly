"use client";

import { useAdminAction } from "@/lib/admin-api";
import { PLAN_LABEL } from "@/lib/labels";
import type { AdminBusinessDetail } from "@/lib/types";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@posly/ui/components/select";
import { LoaderCircle } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

/**
 * Puts a shop on a plan by hand, the monitor's version of `pnpm subscription:set`. Not offered
 * for a Stripe-billed shop: the API refuses, since Stripe's next webhook would undo it.
 */
export function SetPlanDialog({ detail }: { detail: AdminBusinessDetail }) {
	const { business, subscription } = detail;
	const [open, setOpen] = useState(false);
	const [plan, setPlan] = useState(subscription?.plan ?? "FREE");
	const [days, setDays] = useState("");
	const [note, setNote] = useState("");
	const action = useAdminAction<{ plan: string; days?: number; note?: string }, AdminBusinessDetail>(
		`businesses/${business.id}/subscription`
	);

	const daysNumber = days.trim() ? Number(days) : undefined;
	const daysValid = daysNumber === undefined || (Number.isInteger(daysNumber) && daysNumber >= 1 && daysNumber <= 3650);

	const submit = (event: FormEvent) => {
		event.preventDefault();
		if (!daysValid) return;
		action.mutate(
			{ plan, days: daysNumber, note: note.trim() || undefined },
			{
				onSuccess: () => {
					toast.success(`${business.name} เปลี่ยนเป็น ${PLAN_LABEL[plan] ?? plan} แล้ว`);
					setOpen(false);
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
				if (next) {
					setPlan(subscription?.plan ?? "FREE");
					setDays("");
					setNote("");
				}
			}}
		>
			<DialogTrigger asChild>
				<Button variant="outline" size="lg" disabled={subscription?.hasStripe}>
					เปลี่ยนแพ็กเกจ
				</Button>
			</DialogTrigger>
			<DialogContent className="gap-6 p-6 sm:max-w-md">
				<DialogHeader>
					<DialogTitle>เปลี่ยนแพ็กเกจของ {business.name}</DialogTitle>
					<DialogDescription>
						มีผลทันที ร้านไม่ต้องจ่ายผ่าน Stripe และการเปลี่ยนนี้ถูกบันทึกไว้พร้อมชื่อของคุณ
					</DialogDescription>
				</DialogHeader>
				<form id="set-plan" onSubmit={submit} className="grid gap-4">
					<div className="grid gap-2">
						<Label htmlFor="set-plan-plan">แพ็กเกจ</Label>
						<Select value={plan} onValueChange={setPlan}>
							<SelectTrigger id="set-plan-plan" className="w-full data-[size=default]:h-11">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{Object.entries(PLAN_LABEL).map(([code, label]) => (
									<SelectItem key={code} value={code}>
										{label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="set-plan-days">จำนวนวัน</Label>
						<Input
							id="set-plan-days"
							inputMode="numeric"
							value={days}
							onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))}
							placeholder="เว้นว่าง = ไม่มีกำหนด"
							className="h-11"
							aria-invalid={!daysValid}
						/>
						<p className="text-muted-foreground text-xs">
							ครบกำหนดแล้วร้านกลับเป็น Free เอง ใส่ได้ 1–3650 วัน
						</p>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="set-plan-note">เหตุผล (ไม่บังคับ)</Label>
						<Input
							id="set-plan-note"
							value={note}
							maxLength={200}
							onChange={(e) => setNote(e.target.value)}
							placeholder="เช่น ขยายช่วงทดลองใช้"
							className="h-11"
						/>
					</div>
				</form>
				<DialogFooter>
					<Button variant="outline" size="lg" className="h-11 tablet:h-9" onClick={() => setOpen(false)}>
						ยกเลิก
					</Button>
					<Button type="submit" form="set-plan" size="lg" className="brand-gradient h-11 tablet:h-9" disabled={!daysValid || action.isPending}>
						{action.isPending ? <LoaderCircle className="animate-spin" /> : null}
						บันทึก
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
