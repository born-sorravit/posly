"use client";

import { Receipt } from "@/components/receipt/receipt";
import { useActiveBusiness } from "@/hooks/use-workspace";
import type { OrderDto } from "@/lib/api/posly";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** One shared, lazily created root: a direct child of body, which the print CSS keys on. */
const printRoot = (): HTMLElement => {
	let root = document.getElementById("print-root");
	if (!root) {
		root = document.createElement("div");
		root.id = "print-root";
		document.body.appendChild(root);
	}
	return root;
};

/**
 * Prints one receipt and nothing else.
 *
 * The receipt is portalled into `#print-root`; the print stylesheet in globals.css hides
 * every other child of body and sizes the page to the 80 mm roll, so the dialog, toasts and
 * app shell never reach paper, whatever is open.
 *
 * `window.print()` runs only after React has committed the receipt, and the portal is
 * unmounted again on `afterprint`.
 */
export function usePrintReceipt() {
	const { business } = useActiveBusiness();
	const [job, setJob] = useState<{ order: OrderDto; root: HTMLElement } | null>(null);

	useEffect(() => {
		if (!job) return;
		const done = () => setJob(null);
		window.addEventListener("afterprint", done);
		// One frame so the receipt is laid out before the print dialog snapshots the page.
		const frame = window.requestAnimationFrame(() => window.print());
		return () => {
			window.cancelAnimationFrame(frame);
			window.removeEventListener("afterprint", done);
		};
	}, [job]);

	const print = useCallback((order: OrderDto) => setJob({ order, root: printRoot() }), []);

	const portal = job ? createPortal(<Receipt business={business} order={job.order} />, job.root) : null;

	return { print, portal };
}
