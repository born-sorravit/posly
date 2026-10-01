"use client";

import { printRoot } from "@/components/receipt/print-receipt";
import { useActiveBusiness } from "@/hooks/use-workspace";
import type { TableDto } from "@/lib/api/posly";
import { env } from "@/lib/env";
import { Button } from "@posly/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@posly/ui/components/dialog";
import { Copy, Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

/**
 * Where a table's QR leads. Printed codes are permanent, so the address comes from the site the
 * owner is using right now — never a build-time default that could point at localhost.
 */
export const guestUrl = (qrToken: string) =>
	`${typeof window === "undefined" ? env.siteUrl : window.location.origin}/t/${qrToken}`;

/** One table's card as it is printed: shop, table, the code and what to do with it. */
function QrCard({ shopName, table }: { shopName: string; table: TableDto }) {
	const t = useTranslations("tableSettings");
	return (
		<div className="qr-card flex flex-col items-center gap-3 rounded-2xl border border-black/15 p-6 text-center text-black">
			<p className="font-medium text-sm">{shopName}</p>
			<p className="font-bold text-3xl tracking-tight">{table.name}</p>
			<QRCodeSVG value={guestUrl(table.qrToken)} size={200} marginSize={1} />
			<p className="text-sm">{t("scanToOrder")}</p>
		</div>
	);
}

/**
 * Prints QR cards — one table or every table — on A4, two across. Portalled into the shared
 * print root like a receipt; the `.qr-sheet` page rule in globals.css sizes the paper.
 */
export function usePrintQr() {
	const { business } = useActiveBusiness();
	const [job, setJob] = useState<{ tables: TableDto[]; root: HTMLElement } | null>(null);

	useEffect(() => {
		if (!job) return;
		const done = () => setJob(null);
		window.addEventListener("afterprint", done);
		const frame = window.requestAnimationFrame(() => window.print());
		return () => {
			window.cancelAnimationFrame(frame);
			window.removeEventListener("afterprint", done);
		};
	}, [job]);

	const print = useCallback((tables: TableDto[]) => setJob({ tables, root: printRoot() }), []);

	const portal = job
		? createPortal(
				<div className="qr-sheet grid grid-cols-2 gap-6 bg-white">
					{job.tables.map((table) => (
						<QrCard key={table.id} shopName={business.name} table={table} />
					))}
				</div>,
				job.root
			)
		: null;

	return { print, portal };
}

/** A table's QR on screen: to show a guest, copy the link, or print just this one. */
export function TableQrDialog({ table, onOpenChange }: { table: TableDto | null; onOpenChange: (open: boolean) => void }) {
	const t = useTranslations("tableSettings");
	const { print, portal } = usePrintQr();
	const url = table ? guestUrl(table.qrToken) : "";

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(url);
			toast.success(t("copied"));
		} catch {
			toast.error(url);
		}
	};

	return (
		<Dialog open={table !== null} onOpenChange={onOpenChange}>
			<DialogContent className="gap-6 p-6 sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{table ? t("qrTitle", { table: table.name }) : null}</DialogTitle>
					<DialogDescription>{t("qrHint")}</DialogDescription>
				</DialogHeader>
				{table ? (
					<div className="flex flex-col items-center gap-3">
						{/* A white tile in both themes: phone cameras read dark-on-light best. */}
						<div className="rounded-2xl bg-white p-4 shadow-xs">
							<QRCodeSVG value={url} size={220} marginSize={1} />
						</div>
						<p className="max-w-full truncate text-muted-foreground text-xs">{url}</p>
					</div>
				) : null}
				<DialogFooter className="-mx-6 -mb-6 mt-2 px-6 py-4">
					<Button variant="outline" size="lg" onClick={() => void copy()}>
						<Copy />
						{t("copyLink")}
					</Button>
					<Button size="lg" className="brand-gradient" onClick={() => table && print([table])}>
						<Printer />
						{t("print")}
					</Button>
				</DialogFooter>
				{portal}
			</DialogContent>
		</Dialog>
	);
}
