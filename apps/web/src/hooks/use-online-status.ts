"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { toast } from "sonner";

const OFFLINE_TOAST = "offline";

/**
 * "Internet disconnected" (§32): a sticky toast while offline, dismissed on reconnect. The
 * POS keeps working either way — the cart is local — this only tells the cashier why a
 * payment may not sync.
 */
export function useOnlineStatus() {
	const t = useTranslations("common");

	useEffect(() => {
		const offline = () =>
			toast.warning(t("offline"), { id: OFFLINE_TOAST, duration: Number.POSITIVE_INFINITY });
		const online = () => {
			toast.dismiss(OFFLINE_TOAST);
			toast.success(t("online"));
		};
		if (!navigator.onLine) offline();
		window.addEventListener("offline", offline);
		window.addEventListener("online", online);
		return () => {
			window.removeEventListener("offline", offline);
			window.removeEventListener("online", online);
		};
	}, [t]);
}
