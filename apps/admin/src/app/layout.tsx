import { Providers } from "@/components/providers";
import { fontVariables } from "@/lib/fonts";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
	title: { default: "Posly Admin", template: "%s · Posly Admin" },
	description: "Platform monitor for Posly",
	robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="th" className={fontVariables} suppressHydrationWarning>
			<body className="min-h-dvh bg-background font-sans text-foreground antialiased">
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
