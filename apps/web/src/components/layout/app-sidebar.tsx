"use client";

import { Brand } from "@/components/layout/brand";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { StoreSwitcher } from "@/components/layout/store-switcher";
import { UserMenu } from "@/components/layout/user-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@posly/ui/components/tooltip";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { Button } from "@posly/ui/components/button";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

/**
 * Brand, navigation, then store and person at the foot — the plan's §7 layout.
 *
 * One body for the desktop rail and the tablet sheet; `onNavigate` is what the sheet passes
 * to close itself.
 */
export function SidebarBody({
	collapsed = false,
	onNavigate,
	layoutId,
}: {
	collapsed?: boolean;
	onNavigate?: () => void;
	layoutId?: string;
}) {
	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className={cn("flex h-16 items-center px-4", collapsed && "justify-center px-2")}>
				<Brand collapsed={collapsed} onNavigate={onNavigate} />
			</div>

			<div className={cn("min-h-0 flex-1 overflow-y-auto py-2", collapsed ? "px-2" : "px-3")}>
				<SidebarNav collapsed={collapsed} onNavigate={onNavigate} layoutId={layoutId} />
			</div>

			<div className={cn("surface m-2 grid gap-1 rounded-2xl p-1.5", collapsed && "justify-items-center")}>
				<StoreSwitcher collapsed={collapsed} />
				<UserMenu variant={collapsed ? "avatar" : "row"} />
			</div>
		</div>
	);
}

/**
 * The rail's collapse toggle, for the top bar. It lives there — left of search, where the
 * tablet's menu button also sits — so it stays in one place whether the rail is wide or
 * narrow, instead of moving with the rail's contents.
 */
export function SidebarToggle() {
	const t = useTranslations("nav");
	const collapsed = useWorkspaceStore((state) => state.sidebarCollapsed);
	const toggle = useWorkspaceStore((state) => state.toggleSidebar);
	const label = collapsed ? t("expand") : t("collapse");
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant="ghost"
					size="icon-lg"
					onClick={toggle}
					aria-label={label}
					aria-expanded={!collapsed}
					className="hidden text-muted-foreground hover:text-foreground desktop:inline-flex"
				>
					{collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
				</Button>
			</TooltipTrigger>
			<TooltipContent side="bottom">
				{label} <kbd className="ml-1 font-mono">⌘B</kbd>
			</TooltipContent>
		</Tooltip>
	);
}

/** The persistent rail, from `desktop` (1280px) up. Below that the header opens a sheet. */
export function AppSidebar() {
	const collapsed = useWorkspaceStore((state) => state.sidebarCollapsed);
	const toggle = useWorkspaceStore((state) => state.toggleSidebar);

	// ⌘B / Ctrl+B, the shortcut every editor and dashboard uses for the side panel.
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key?.toLowerCase() === "b" && (event.metaKey || event.ctrlKey) && !event.altKey) {
				event.preventDefault();
				toggle();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [toggle]);

	return (
		<aside
			className={cn(
				"sticky top-0 hidden h-svh shrink-0 border-sidebar-border border-r bg-sidebar transition-[width] duration-200 desktop:block",
				collapsed ? "w-[76px]" : "w-64"
			)}
		>
			<SidebarBody collapsed={collapsed} />
		</aside>
	);
}
