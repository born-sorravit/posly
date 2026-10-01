"use client";

import { useTableBoard } from "@/hooks/use-posly";
import { useActiveBusiness, useFeature } from "@/hooks/use-workspace";
import { useRouter } from "@/i18n/navigation";
import { TableRequestToast } from "@/components/tables/table-request-toast";
import { play } from "@/lib/sounds";
import { HandPlatter, ReceiptText, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Wherever staff are in the app, a guest's round from a table's QR is announced: a chime and
 * a toast that opens the table. Counts are compared with the last board seen, so the first
 * load (and a round already announced) stays quiet.
 */
export function TableRequestAlert() {
	const { can } = useActiveBusiness();
	// Only guests send rounds, so only shops that take QR orders listen for them.
	const qrOrdering = useFeature("QR_ORDERING");
	const board = useTableBoard(can("pos:use") && qrOrdering);
	const router = useRouter();
	const t = useTranslations("tables.alert");
	const seen = useRef<Map<string, number> | null>(null);
	// When each table last called, so only a new call (not the same one on every refetch) rings.
	const seenCalls = useRef<Map<string, string> | null>(null);
	const audio = useRef<AudioContext | null>(null);

	useEffect(() => {
		if (!board.data) return;
		const counts = new Map(board.data.flatMap((table) => (table.tab ? [[table.tab.id, table.tab.pendingRequests] as const] : [])));
		const before = seen.current;
		seen.current = counts;
		const calls = new Map(board.data.flatMap((table) => (table.call ? [[table.id, table.call.at] as const] : [])));
		const callsBefore = seenCalls.current;
		seenCalls.current = calls;
		if (!before || !callsBefore) return;

		let rang = false;
		for (const table of board.data) {
			const call = table.call;
			if (!call || callsBefore.get(table.id) === call.at) continue;
			rang = true;
			const go = () =>
				router.push(table.tab ? { pathname: "/tables", query: { tab: table.tab.id } } : "/tables");
			toast.custom(
				(toastId) => (
					<TableRequestToast
						title={t(
							call.kind === "PAID" ? "paidTitle" : call.kind === "BILL" ? "billTitle" : "waiterTitle",
							{ table: table.name }
						)}
						hint={call.kind === "PAID" ? t("paidCallHint") : t("callHint")}
						viewLabel={t("viewTable")}
						icon={call.kind === "PAID" ? Wallet : call.kind === "BILL" ? ReceiptText : HandPlatter}
						onView={() => {
							toast.dismiss(toastId);
							go();
						}}
						onDismiss={() => toast.dismiss(toastId)}
					/>
				),
				{ id: `table-call-${table.id}`, duration: 15_000 }
			);
		}
		for (const table of board.data) {
			const tab = table.tab;
			if (!tab || tab.pendingRequests <= (before.get(tab.id) ?? 0)) continue;
			rang = true;
			const id = `table-request-${tab.id}`;
			toast.custom(
				(toastId) => (
					<TableRequestToast
						title={t("new", { table: table.name })}
						hint={t("waiting", { count: tab.pendingRequests })}
						viewLabel={t("view")}
						onView={() => {
							toast.dismiss(toastId);
							router.push({ pathname: "/tables", query: { tab: tab.id } });
						}}
						onDismiss={() => toast.dismiss(toastId)}
					/>
				),
				// Stays until seen: a waiting table must not slip by while staff look away.
				{ id, duration: 15_000 }
			);
		}
		if (rang) {
			try {
				audio.current ??= new AudioContext();
				play(audio.current, "chime");
			} catch {
				// No audio before the first tap on the page, or none at all: the toast still shows.
			}
		}
	}, [board.data, router, t]);

	return null;
}
