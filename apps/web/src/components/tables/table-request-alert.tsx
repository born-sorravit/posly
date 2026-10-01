"use client";

import { useTableBoard } from "@/hooks/use-posly";
import { useActiveBusiness } from "@/hooks/use-workspace";
import { useRouter } from "@/i18n/navigation";
import { play } from "@/lib/sounds";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Wherever staff are in the app, a guest's round from a table's QR is announced: a chime and
 * a toast that opens the table. Counts are compared with the last board seen, so the first
 * load (and a round already announced) stays quiet.
 */
export function TableRequestAlert() {
	const t = useTranslations("tables.alert");
	const { can } = useActiveBusiness();
	const board = useTableBoard(can("pos:use"));
	const router = useRouter();
	const seen = useRef<Map<string, number> | null>(null);
	const audio = useRef<AudioContext | null>(null);

	useEffect(() => {
		if (!board.data) return;
		const counts = new Map(board.data.flatMap((table) => (table.tab ? [[table.tab.id, table.tab.pendingRequests] as const] : [])));
		const before = seen.current;
		seen.current = counts;
		if (!before) return;

		let rang = false;
		for (const table of board.data) {
			const tab = table.tab;
			if (!tab || tab.pendingRequests <= (before.get(tab.id) ?? 0)) continue;
			rang = true;
			toast(t("new", { table: table.name }), {
				id: `table-request-${tab.id}`,
				action: { label: t("view"), onClick: () => router.push({ pathname: "/tables", query: { tab: tab.id } }) },
			});
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
