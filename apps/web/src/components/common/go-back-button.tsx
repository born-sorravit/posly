"use client";

import { Button } from "@posly/ui/components/button";
import { useRouter } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

/** History back when there is somewhere to go back to; otherwise the fallback page. */
export function GoBackButton({ children, fallback = "/dashboard" }: { children: ReactNode; fallback?: string }) {
	const router = useRouter();
	return (
		<Button
			variant="outline"
			size="lg"
			onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
		>
			<ArrowLeft />
			{children}
		</Button>
	);
}
