"use client";

import { Button } from "@posly/ui/components/button";
import { BellRing, X } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * A guest's round as a toast card: which table, how many rounds wait, and one button to open
 * it. Rendered through `toast.custom`, so it carries the app's own surface rather than
 * sonner's default strip.
 */
export function TableRequestToast({
	table,
	waiting,
	onView,
	onDismiss,
}: {
	table: string;
	waiting: number;
	onView: () => void;
	onDismiss: () => void;
}) {
	const t = useTranslations("tables.alert");
	return (
		<div className="surface flex w-[min(380px,calc(100vw-2rem))] items-start gap-3 rounded-2xl p-4 shadow-lg">
			{/* Solid warning with its own foreground (the token pair for text on warning), and a soft
			    pulse behind it: the one thing on screen asking for attention. */}
			<span className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning text-warning-foreground shadow-sm">
				<span className="absolute inset-0 animate-ping rounded-xl bg-warning opacity-30" aria-hidden />
				<BellRing className="relative size-5" strokeWidth={2.25} />
			</span>
			<div className="min-w-0 flex-1 space-y-3">
				<div>
					<p className="font-semibold text-sm">{t("new", { table })}</p>
					<p className="text-muted-foreground text-xs">{t("waiting", { count: waiting })}</p>
				</div>
				<Button size="sm" className="h-9 w-full rounded-lg" onClick={onView}>
					{t("view")}
				</Button>
			</div>
			<button
				type="button"
				onClick={onDismiss}
				aria-label={t("dismiss")}
				className="-mt-1 -mr-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
			>
				<X className="size-4" />
			</button>
		</div>
	);
}
