"use client";

import { Button } from "@posly/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@posly/ui/components/dialog";
import { Share, SquarePlus, WifiOff } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useSyncExternalStore } from "react";
import { create } from "zustand";

/** Chrome/Edge/Android's install event; not in lib.dom. */
interface BeforeInstallPromptEvent extends Event {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const usePwaStore = create<{ prompt: BeforeInstallPromptEvent | null; installed: boolean }>(() => ({
	prompt: null,
	installed: false,
}));

const isStandalone = () =>
	typeof window !== "undefined" &&
	(window.matchMedia("(display-mode: standalone)").matches ||
		window.matchMedia("(display-mode: fullscreen)").matches ||
		// iOS Safari's own flag for a home-screen launch.
		(navigator as Navigator & { standalone?: boolean }).standalone === true);

const isIos = () =>
	typeof navigator !== "undefined" &&
	(/iPad|iPhone|iPod/.test(navigator.userAgent) ||
		// iPadOS reports itself as a Mac with touch.
		(navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

/**
 * Registers the service worker (production only — in dev it would cache the hot-reloading
 * bundles) and keeps the browser's install offer for the "ติดตั้งแอป" menu item.
 */
export function PwaRuntime() {
	useEffect(() => {
		const onPrompt = (event: Event) => {
			// Keep it for our own menu item instead of the browser's mini-infobar.
			event.preventDefault();
			usePwaStore.setState({ prompt: event as BeforeInstallPromptEvent });
		};
		const onInstalled = () => usePwaStore.setState({ prompt: null, installed: true });
		window.addEventListener("beforeinstallprompt", onPrompt);
		window.addEventListener("appinstalled", onInstalled);

		if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
			navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
				// Without it the app still works; it only loses the offline page.
			});
		}
		return () => {
			window.removeEventListener("beforeinstallprompt", onPrompt);
			window.removeEventListener("appinstalled", onInstalled);
		};
	}, []);

	return <OfflineBanner />;
}

const noSubscribe = () => () => {};

const subscribeOnline = (notify: () => void) => {
	window.addEventListener("online", notify);
	window.addEventListener("offline", notify);
	return () => {
		window.removeEventListener("online", notify);
		window.removeEventListener("offline", notify);
	};
};

/** A pill near the bottom (clear of toasts and the phone tab bar) while the connection is down: sales cannot be recorded until it is back. */
function OfflineBanner() {
	const t = useTranslations("pwa");
	const online = useSyncExternalStore(
		subscribeOnline,
		() => navigator.onLine,
		() => true
	);
	return (
		<AnimatePresence>
			{online ? null : (
				<motion.div
					role="status"
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: 12 }}
					className="-translate-x-1/2 fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] left-1/2 tablet:bottom-6 z-[60] flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full bg-foreground px-4 py-2 text-background text-sm shadow-lg"
				>
					<WifiOff className="size-4 shrink-0" />
					<span className="truncate">{t("offline")}</span>
				</motion.div>
			)}
		</AnimatePresence>
	);
}

/**
 * Whether to offer "install", and how: the browser's own prompt where there is one, or the
 * Share → Add to Home Screen steps on iOS, which has no prompt. Nothing once installed.
 */
export function useInstallApp() {
	const prompt = usePwaStore((s) => s.prompt);
	const installed = usePwaStore((s) => s.installed);
	// Client-only facts. The server snapshot says "installed", so nothing is offered in the
	// server HTML and the first client render matches it.
	const ios = useSyncExternalStore(noSubscribe, isIos, () => false);
	const standalone = useSyncExternalStore(noSubscribe, isStandalone, () => true);

	const mode: "prompt" | "ios" | null =
		installed || standalone ? null : prompt ? "prompt" : ios ? "ios" : null;

	const install = async () => {
		if (!prompt) return;
		await prompt.prompt();
		const { outcome } = await prompt.userChoice;
		usePwaStore.setState({ prompt: null, installed: outcome === "accepted" });
	};
	return { mode, install };
}

export function IosInstallDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
	const t = useTranslations("pwa");
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="gap-5 p-6 sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>{t("iosTitle")}</DialogTitle>
					<DialogDescription>{t("iosHint")}</DialogDescription>
				</DialogHeader>
				<ol className="space-y-3 text-sm">
					<li className="flex items-center gap-3">
						<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
							<Share className="size-4" />
						</span>
						{t("iosStep1")}
					</li>
					<li className="flex items-center gap-3">
						<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
							<SquarePlus className="size-4" />
						</span>
						{t("iosStep2")}
					</li>
				</ol>
				<Button size="lg" variant="outline" onClick={() => onOpenChange(false)}>
					{t("gotIt")}
				</Button>
			</DialogContent>
		</Dialog>
	);
}
