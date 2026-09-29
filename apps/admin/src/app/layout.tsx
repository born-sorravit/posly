import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
	title: { default: "Posly Admin", template: "%s · Posly Admin" },
	robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="th">
			<body className="min-h-dvh bg-background text-foreground antialiased">{children}</body>
		</html>
	);
}
