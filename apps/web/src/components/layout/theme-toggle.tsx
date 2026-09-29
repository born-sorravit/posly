"use client";

import { Button } from "@posly/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@posly/ui/components/tooltip";
import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

/**
 * Light / dark switch for the top bar. The icon shows where a click takes you: a moon in
 * light mode, a sun in dark mode.
 *
 * Which icon (and label) shows is decided by CSS, not React state: next-themes writes
 * `class="dark"` on <html> before first paint, so server and client render the same markup
 * and there is no mounted flag and no icon flicker.
 */
export function ThemeToggle() {
	const { resolvedTheme, setTheme } = useTheme();
	const t = useTranslations("userMenu");

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant="ghost"
					size="icon-lg"
					aria-label={t("toggleTheme")}
					onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
					className="text-muted-foreground hover:text-foreground"
				>
					<Moon className="size-5 dark:hidden" />
					<Sun className="hidden size-5 dark:block" />
				</Button>
			</TooltipTrigger>
			<TooltipContent side="bottom">
				<span className="dark:hidden">{t("darkMode")}</span>
				<span className="hidden dark:inline">{t("lightMode")}</span>
			</TooltipContent>
		</Tooltip>
	);
}
