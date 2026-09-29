"use client";

import { SidebarBody, SidebarToggle } from "@/components/layout/app-sidebar";
import { useCommandMenu } from "@/components/layout/command-menu";
import { NotificationsButton } from "@/components/layout/notifications-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { PageTourButton } from "@/components/tour/product-tour";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@posly/ui/components/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@posly/ui/components/sheet";
import { StoreSwitcher } from "@/components/layout/store-switcher";
import { useActiveBusiness } from "@/hooks/use-workspace";
import { useNow } from "@/hooks/use-now";
import { formatClock, formatThaiDate } from "@posly/utils/format";
import { Menu, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

/**
 * The top bar. The same component at every width, rearranged:
 *
 *   desktop (≥1280)  search · clock · bell           (sidebar carries brand, store, user)
 *   tablet  (768+)   ☰ · search · clock · bell · avatar
 *   mobile  (<768)   store · search icon · avatar    (bell moves to the bottom nav; no
 *                                                     sidebar, so the store switcher lives here)
 */
export function AppHeader() {
	const t = useTranslations("header");
	const tNav = useTranslations("nav");
	const [menuOpen, setMenuOpen] = useState(false);
	const openCommand = useCommandMenu((state) => state.setOpen);
	const { business } = useActiveBusiness();
	const now = useNow(30_000);

	return (
		<header className="sticky top-0 z-30 flex h-16 items-center gap-2 bg-background/70 px-4 backdrop-blur-xl backdrop-saturate-150 tablet:gap-3 desktop:pr-6 desktop:pl-3">
			<Sheet open={menuOpen} onOpenChange={setMenuOpen}>
				<SheetTrigger asChild>
					<Button
						variant="ghost"
						size="icon-lg"
						className="hidden tablet:inline-flex desktop:hidden"
						aria-label={tNav("menu")}
					>
						<Menu className="size-5" />
					</Button>
				</SheetTrigger>
				<SheetContent side="left" className="w-72 bg-sidebar p-0" showCloseButton={false}>
					<SheetTitle className="sr-only">{tNav("menu")}</SheetTitle>
					<SidebarBody onNavigate={() => setMenuOpen(false)} layoutId="sheet-active" />
				</SheetContent>
			</Sheet>

			<SidebarToggle />

			<div className="min-w-0 flex-1 tablet:hidden">
				<StoreSwitcher placement="header" />
			</div>

			<button
				type="button"
				onClick={() => openCommand(true)}
				data-tour="search"
				className="surface surface-hover group hidden h-10 w-full max-w-md items-center gap-2.5 rounded-xl px-3 text-muted-foreground text-sm tablet:flex"
			>
				<Search className="size-4" />
				<span className="flex-1 truncate text-left">{t("search")}</span>
				<kbd className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px]">⌘ K</kbd>
			</button>

			<div className="ml-auto flex items-center gap-1 tablet:gap-2">
				<Button
					variant="ghost"
					size="icon-lg"
					className="tablet:hidden"
					onClick={() => openCommand(true)}
					aria-label={t("search")}
				>
					<Search className="size-5" />
				</Button>

				<div className="hidden flex-col items-end leading-tight tablet:flex" suppressHydrationWarning>
					<span className="numeric font-semibold text-sm">{formatClock(now)}</span>
					<span className="text-muted-foreground text-xs">{formatThaiDate(now)}</span>
				</div>

				<PageTourButton />
				<ThemeToggle />

				<div className="hidden tablet:block">
					<NotificationsButton />
				</div>

				<div className="desktop:hidden">
					<UserMenu variant="avatar" />
				</div>
				<span className="sr-only">{business.name}</span>
			</div>
		</header>
	);
}
