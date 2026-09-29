"use client";

import { Button } from "@posly/ui/components/button";
import { Input } from "@posly/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@posly/ui/components/popover";
import { useActiveBusiness } from "@/hooks/use-workspace";
import { api } from "@/lib/api/posly";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * "ส่งใบเสร็จ": the customer types or says their email, the receipt goes out as the printed
 * slip has it. The address is never remembered — the next customer at this till must not
 * see it.
 */
export function SendReceiptButton({ orderId, className, size }: { orderId: string; className?: string; size?: "lg" }) {
	const t = useTranslations("receiptMail");
	const { business } = useActiveBusiness();
	const [open, setOpen] = useState(false);
	const [email, setEmail] = useState("");
	const send = useMutation({ mutationFn: (to: string) => api.orders.sendReceipt(business.id, orderId, to) });
	const valid = EMAIL.test(email.trim());

	const submit = () => {
		if (!valid || send.isPending) return;
		const to = email.trim();
		send.mutate(to, {
			onSuccess: ({ delivered }) => {
				if (delivered) toast.success(t("sent", { email: to }));
				else toast.warning(t("notConfigured"), { description: t("notConfiguredHint") });
				setEmail("");
				setOpen(false);
			},
			onError: (e) => toast.error(e.message),
		});
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button variant="outline" size={size} className={cn(className)}>
					<Send />
					{t("button")}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-80 space-y-3 p-4">
				<div>
					<p className="font-semibold text-sm">{t("title")}</p>
					<p className="text-muted-foreground text-xs">{t("hint")}</p>
				</div>
				<form
					className="flex gap-2"
					onSubmit={(e) => {
						e.preventDefault();
						submit();
					}}
				>
					<Input
						type="email"
						inputMode="email"
						autoComplete="off"
						// biome-ignore lint/a11y/noAutofocus: the popover opens for this field
						autoFocus
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="name@example.com"
						aria-label={t("email")}
						className="h-10 rounded-lg"
					/>
					<Button type="submit" className="brand-gradient h-10" disabled={!valid || send.isPending}>
						{send.isPending ? <Loader2 className="animate-spin" /> : t("send")}
					</Button>
				</form>
			</PopoverContent>
		</Popover>
	);
}
