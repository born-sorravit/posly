"use client";

import { useSession } from "@/components/providers/session-provider";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@posly/ui/components/button";
import { useQueryClient } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";
import { useTranslations } from "next-intl";
import { useLayoutEffect, useRef } from "react";

/**
 * A thin strip over every app screen while a shared demo account is signed in.
 *
 * Screens sized to the viewport (POS, kitchen) subtract the top bar from 100svh; they also
 * subtract `--demo-banner-h`, which this keeps equal to the strip's real height (0 without it).
 */
export function DemoBanner() {
	const t = useTranslations("demo.banner");
	const { user, signOut } = useSession();
	const router = useRouter();
	const queryClient = useQueryClient();
	const ref = useRef<HTMLDivElement>(null);
	const show = user?.isDemo === true;

	useLayoutEffect(() => {
		const root = document.documentElement;
		const el = ref.current;
		if (!show || !el) return;
		const update = () => root.style.setProperty("--demo-banner-h", `${el.offsetHeight}px`);
		update();
		const observer = new ResizeObserver(update);
		observer.observe(el);
		return () => {
			observer.disconnect();
			root.style.removeProperty("--demo-banner-h");
		};
	}, [show]);

	if (!show) return null;

	return (
		<div ref={ref} className="flex items-center justify-center gap-3 bg-primary px-4 py-1.5 text-primary-foreground text-xs tablet:text-sm">
			<FlaskConical className="hidden size-4 shrink-0 tablet:block" />
			<span className="min-w-0 truncate">{t("text")}</span>
			<Button
				size="sm"
				variant="secondary"
				className="h-7 shrink-0 px-3 text-xs"
				onClick={async () => {
					await signOut();
					queryClient.clear();
					router.push("/register");
					router.refresh();
				}}
			>
				{t("signup")}
			</Button>
		</div>
	);
}
