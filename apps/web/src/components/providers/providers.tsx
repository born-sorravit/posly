"use client";

import { PwaRuntime } from "@/components/pwa/pwa";
import { QueryProvider } from "@/components/providers/query-provider";
import { SessionProvider } from "@/components/providers/session-provider";
import { Toaster } from "@posly/ui/components/sonner";
import { TooltipProvider } from "@posly/ui/components/tooltip";
import type { AuthUser } from "@posly/types/api";
import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * next-themes renders its no-flash script inline. It only does anything in the server HTML,
 * before hydration; on the client React never runs it, and React 19.2 warns about any
 * executable <script> rendered there. So the client copy is typed as inert data — the
 * element already carries `suppressHydrationWarning`, so the differing `type` is ignored.
 */
const themeScriptProps = typeof window === "undefined" ? undefined : { type: "application/json" };

export function Providers({
	children,
	initialUser,
}: {
	children: ReactNode;
	initialUser: AuthUser | null;
}) {
	return (
		<ThemeProvider
			attribute="class"
			defaultTheme="light"
			enableSystem
			disableTransitionOnChange
			scriptProps={themeScriptProps}
		>
			{/*
			 * One place decides how motion behaves: a reader who asked for less keeps an
			 * identical tree (nothing mismatches on hydration) with the transforms dropped.
			 * Durations are short everywhere — the POS has to feel instant (plan §35).
			 */}
			<MotionConfig reducedMotion="user" transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}>
				<QueryProvider>
					<SessionProvider initialUser={initialUser}>
						<TooltipProvider delayDuration={300}>
							{children}
							<PwaRuntime />
							<Toaster richColors position="top-center" />
						</TooltipProvider>
					</SessionProvider>
				</QueryProvider>
			</MotionConfig>
		</ThemeProvider>
	);
}
