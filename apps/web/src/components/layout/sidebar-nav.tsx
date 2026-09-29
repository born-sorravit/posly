"use client";

import { isActivePath, visibleSections } from "@/components/layout/nav-items";
import { useActiveBusiness } from "@/hooks/use-workspace";
import { Tooltip, TooltipContent, TooltipTrigger } from "@posly/ui/components/tooltip";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

/**
 * The navigation list. `collapsed` shows icons only, each with a tooltip carrying the label
 * the rail no longer has room for.
 */
export function SidebarNav({
	collapsed = false,
	onNavigate,
	layoutId = "sidebar-active",
}: {
	collapsed?: boolean;
	onNavigate?: () => void;
	/** Distinct per instance, so the rail and the sheet do not animate into each other. */
	layoutId?: string;
}) {
	const t = useTranslations("nav");
	const pathname = usePathname();
	const { can } = useActiveBusiness();

	return (
		<nav className="grid gap-5">
			{visibleSections(can).map((section) => (
				<div key={section.key} className="grid gap-0.5">
					{section.key === "catalog" && !collapsed ? (
						<p className="px-3 pb-1 font-medium text-muted-foreground/80 text-xs">
							{t("sections.catalog")}
						</p>
					) : null}

					{section.items.map(({ key, href, icon: Icon }) => {
						const active = isActivePath(pathname, href);

						const link = (
							<Link
								key={key}
								href={href}
								onClick={onNavigate}
								data-tour={`nav-${key}`}
								aria-current={active ? "page" : undefined}
								aria-label={collapsed ? t(key) : undefined}
								className={cn(
									"group relative flex h-10 items-center gap-3 rounded-xl px-3 font-medium text-sm transition-colors duration-150",
									collapsed && "justify-center px-0",
									active
										? "text-accent-foreground"
										: "text-muted-foreground hover:bg-muted hover:text-foreground"
								)}
							>
								{/* One shared element slides between items instead of two cross-fading. */}
								{active ? (
									<motion.span
										layoutId={layoutId}
										aria-hidden
										className="absolute inset-0 rounded-xl bg-accent"
										transition={{ type: "spring", stiffness: 500, damping: 38 }}
									/>
								) : null}
								<Icon
									className={cn(
										"relative size-[18px] shrink-0",
										active ? "text-primary" : "group-hover:text-foreground"
									)}
								/>
								{collapsed ? null : <span className="relative truncate">{t(key)}</span>}
							</Link>
						);

						return collapsed ? (
							<Tooltip key={key}>
								<TooltipTrigger asChild>{link}</TooltipTrigger>
								<TooltipContent side="right">{t(key)}</TooltipContent>
							</Tooltip>
						) : (
							link
						);
					})}
				</div>
			))}
		</nav>
	);
}
