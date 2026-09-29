"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@posly/ui/components/tooltip";
import { Button } from "@posly/ui/components/button";
import { Maximize, Minimize } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";

/** Safari on iPad still only has the prefixed API. */
type WebkitDocument = Document & {
	webkitFullscreenEnabled?: boolean;
	webkitFullscreenElement?: Element | null;
	webkitExitFullscreen?: () => Promise<void> | void;
};
type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

const doc = () => document as WebkitDocument;
const supported = () => Boolean(doc().fullscreenEnabled ?? doc().webkitFullscreenEnabled);
const current = () => Boolean(doc().fullscreenElement ?? doc().webkitFullscreenElement);

const subscribe = (onChange: () => void) => {
	document.addEventListener("fullscreenchange", onChange);
	document.addEventListener("webkitfullscreenchange", onChange);
	return () => {
		document.removeEventListener("fullscreenchange", onChange);
		document.removeEventListener("webkitfullscreenchange", onChange);
	};
};

/**
 * Full screen for the whole app, for a till that should show nothing but the POS. An icon in
 * the top bar beside theme and notifications: the same place on every screen, and never over
 * a product card or the cart's pay button the way a floating corner button was. Phones get no
 * button — little use for it, and no room in their top bar.
 *
 * The state is read from the document, so leaving with Esc or the browser's own control keeps
 * the icon right. Hidden where the browser has no fullscreen (Safari on iPhone).
 */
export function FullscreenToggle() {
	const t = useTranslations("header");
	const canFullscreen = useSyncExternalStore(subscribe, supported, () => false);
	const isFullscreen = useSyncExternalStore(subscribe, current, () => false);

	if (!canFullscreen) return null;

	const toggle = async () => {
		try {
			if (current()) {
				await (document.exitFullscreen?.() ?? doc().webkitExitFullscreen?.());
			} else {
				const root = document.documentElement as WebkitElement;
				await (root.requestFullscreen?.({ navigationUI: "hide" }) ?? root.webkitRequestFullscreen?.());
			}
		} catch {
			toast.error(t("fullscreenFailed"));
		}
	};

	const label = isFullscreen ? t("exitFullscreen") : t("enterFullscreen");
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant="ghost"
					size="icon-lg"
					aria-label={label}
					aria-pressed={isFullscreen}
					onClick={toggle}
					className="hidden text-muted-foreground hover:text-foreground tablet:inline-flex"
				>
					{isFullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
				</Button>
			</TooltipTrigger>
			<TooltipContent side="bottom">{label}</TooltipContent>
		</Tooltip>
	);
}
