"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@posly/ui/components/tooltip";
import { usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
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
 * Full screen for the whole app, for a till that should show nothing but the POS: a small
 * round button floating at the bottom right, out of the header's way.
 *
 * On the POS the bottom right is the cart's pay button, so there it sits at the bottom right
 * of the product grid instead, clear of the cart panel (340px, 392px on desktop). Phones get
 * no button — they have a tab bar there and little use for it.
 *
 * The state is read from the document, so leaving with Esc or the browser's own control keeps
 * the icon right. Hidden where the browser has no fullscreen (Safari on iPhone).
 */
export function FullscreenToggle() {
	const pathname = usePathname();
	const onPos = pathname === "/pos" || pathname.startsWith("/pos/");
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
				<button
					type="button"
					aria-label={label}
					aria-pressed={isFullscreen}
					onClick={toggle}
					className={cn(
						"surface fixed bottom-5 z-40 hidden size-11 items-center justify-center rounded-full text-muted-foreground backdrop-blur transition-[color,transform,right] hover:scale-105 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 tablet:flex",
						onPos ? "right-[calc(340px+1.25rem)] desktop:right-[calc(392px+1.25rem)]" : "right-5"
					)}
				>
					{isFullscreen ? <Minimize className="size-[18px]" /> : <Maximize className="size-[18px]" />}
				</button>
			</TooltipTrigger>
			<TooltipContent side="left">{label}</TooltipContent>
		</Tooltip>
	);
}
