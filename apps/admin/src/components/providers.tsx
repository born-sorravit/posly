"use client";

import { Toaster } from "@posly/ui/components/sonner";
import { TooltipProvider } from "@posly/ui/components/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { type ReactNode, useState } from "react";

/** See apps/web's Providers: the client copy of next-themes' script is typed as inert data. */
const themeScriptProps = typeof window === "undefined" ? undefined : { type: "application/json" };

export function Providers({ children }: { children: ReactNode }) {
	// Inside state, not module scope, so the server never shares one cache across requests.
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true },
				},
			})
	);

	return (
		<ThemeProvider
			attribute="class"
			defaultTheme="light"
			enableSystem
			disableTransitionOnChange
			scriptProps={themeScriptProps}
		>
			<QueryClientProvider client={queryClient}>
				<TooltipProvider delayDuration={300}>
					{children}
					<Toaster richColors position="top-center" />
				</TooltipProvider>
			</QueryClientProvider>
		</ThemeProvider>
	);
}
