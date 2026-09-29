import type { ReactNode } from "react";

/**
 * The real shell lives in `[locale]/layout.tsx`, which needs the resolved locale for
 * `<html lang>`. This root layout only exists because Next requires one; it must not
 * render `<html>` itself or the two would nest.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
	return children;
}
