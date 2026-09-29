"use client";

import { EmptyState, PageContainer } from "@/components/common/primitives";
import { Button } from "@posly/ui/components/button";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

/** A page that failed to render keeps the shell and offers a retry (§32). */
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
	const t = useTranslations("errors");
	return (
		<PageContainer>
			<EmptyState
				icon={TriangleAlert}
				title={t("title")}
				description={t("hint")}
				action={
					<Button size="lg" onClick={reset}>
						<RotateCcw />
						{t("retry")}
					</Button>
				}
			/>
		</PageContainer>
	);
}
