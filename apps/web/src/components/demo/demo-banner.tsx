"use client";

import { useSession } from "@/components/providers/session-provider";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@posly/ui/components/button";
import { useQueryClient } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";
import { useTranslations } from "next-intl";

/** A thin strip over every app screen while a shared demo account is signed in. */
export function DemoBanner() {
	const t = useTranslations("demo.banner");
	const { user, signOut } = useSession();
	const router = useRouter();
	const queryClient = useQueryClient();

	if (!user?.isDemo) return null;

	return (
		<div className="flex items-center justify-center gap-3 bg-primary px-4 py-1.5 text-primary-foreground text-xs tablet:text-sm">
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
