"use client";

import { KITCHEN_CHANGE, queryKeys, useWorkspace } from "@/components/providers/workspace-provider";
import { backend } from "@/lib/api/backend";
import { env } from "@/lib/env";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { create } from "zustand";

/** Whether this tab is hearing live events; screens slow their safety-net polling when it is. */
export const useRealtime = create<{ connected: boolean }>(() => ({ connected: false }));

const BACKOFF_MS = [1000, 2000, 5000, 10_000, 30_000];

/**
 * Keeps one Server-Sent Events stream open for the shop in use (plan §27) and turns its
 * signals into cache invalidations: a sale on one till redraws the dashboard, the orders
 * list and the kitchen screen everywhere else within a second.
 *
 * The stream is opened with a one-minute ticket fetched through the normal authenticated
 * API (EventSource cannot send our session). On any error it closes, waits a little longer
 * each time, and starts over with a new ticket; on reconnect everything is re-read once, so
 * events missed while offline cost nothing. Polling stays on underneath, slower.
 */
export function RealtimeBridge() {
	const businessId = useWorkspace().business.id;
	const queryClient = useQueryClient();

	useEffect(() => {
		let source: EventSource | null = null;
		let retry: ReturnType<typeof setTimeout> | null = null;
		let attempt = 0;
		let stopped = false;
		const pending = new Map<string, ReturnType<typeof setTimeout>>();

		// A burst of events (a rush of sales) becomes one refetch per topic.
		const refresh = (topic: string, keys: readonly (readonly unknown[])[]) => {
			// A tap on the kitchen screen is still on its way: its own settle re-reads the board
			// once it lands, and a read now could briefly undo it.
			if (topic === "kitchen" && queryClient.isMutating({ mutationKey: KITCHEN_CHANGE }) > 0) return;
			if (pending.has(topic)) return;
			pending.set(
				topic,
				setTimeout(() => {
					pending.delete(topic);
					for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
				}, 250)
			);
		};
		const b = (...rest: string[]) => ["business", businessId, ...rest] as const;
		const topics: Record<string, readonly (readonly unknown[])[]> = {
			orders: [b("orders"), b("order"), b("dashboard"), queryKeys.products(businessId), b("customers")],
			kitchen: [b("kitchen")],
			// The floor screen, open tabs and guests' rounds waiting to be accepted.
			tables: [b("tables")],
			notifications: [queryKeys.notifications(businessId)],
		};

		const schedule = () => {
			if (stopped) return;
			useRealtime.setState({ connected: false });
			const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
			attempt += 1;
			retry = setTimeout(() => void connect(), delay);
		};

		const connect = async () => {
			source?.close();
			if (stopped) return;
			try {
				const { ticket } = await backend.post<{ ticket: string }>(`/businesses/${businessId}/realtime/ticket`);
				if (stopped) return;
				source = new EventSource(`${env.apiBaseUrl}/realtime/stream?ticket=${encodeURIComponent(ticket)}`);
			} catch {
				schedule();
				return;
			}
			source.addEventListener("ready", () => {
				const reconnected = attempt > 0;
				attempt = 0;
				useRealtime.setState({ connected: true });
				// Whatever happened while the stream was down is picked up now.
				if (reconnected) for (const [topic, keys] of Object.entries(topics)) refresh(topic, keys);
			});
			for (const [topic, keys] of Object.entries(topics)) {
				source.addEventListener(topic, () => refresh(topic, keys));
			}
			// EventSource retries by itself with the same (now expired) ticket; do it ourselves.
			source.onerror = () => {
				source?.close();
				schedule();
			};
		};

		const onOnline = () => {
			if (retry) clearTimeout(retry);
			attempt = 0;
			void connect();
		};
		window.addEventListener("online", onOnline);
		void connect();

		return () => {
			stopped = true;
			window.removeEventListener("online", onOnline);
			if (retry) clearTimeout(retry);
			for (const timer of pending.values()) clearTimeout(timer);
			source?.close();
			useRealtime.setState({ connected: false });
		};
	}, [businessId, queryClient]);

	return null;
}
