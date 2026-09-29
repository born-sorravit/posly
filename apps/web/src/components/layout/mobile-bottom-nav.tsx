"use client";

import { isActivePath } from "@/components/layout/nav-items";
import { Link, usePathname } from "@/i18n/navigation";
import { useActiveBusiness } from "@/hooks/use-workspace";
import { useNotifications } from "@/hooks/use-posly";
import { cn } from "@/lib/utils";
import { BarChart3, Bell, Home, Plus, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";

const ITEMS = [
	{ key: "home", href: "/dashboard", icon: Home, permission: "reports:read" },
	{ key: "reports", href: "/reports", icon: BarChart3, permission: "reports:read" },
	{ key: "sell", href: "/pos", icon: Plus, permission: "pos:use" },
	{ key: "notifications", href: "/notifications", icon: Bell, permission: null },
	{ key: "profile", href: "/settings", icon: UserRound, permission: "settings:manage" },
] as const;

/**
 * The owner's phone navigation (plan §29): Home, Reports, a raised "+" that opens the POS,
 * Notifications, Profile. Thumb-reachable, 64px tall, and clear of the home indicator.
 */
export function MobileBottomNav() {
	const t = useTranslations("mobileNav");
	const pathname = usePathname();
	const unread = useNotifications().data?.unread ?? 0;
	const { can } = useActiveBusiness();
	const items = ITEMS.filter((item) => item.permission === null || can(item.permission));

	return (
		<nav
			className="fixed inset-x-0 bottom-0 z-40 bg-background/85 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-12px_oklch(0.3_0.06_270/0.18)] backdrop-blur-xl tablet:hidden"
			aria-label={t("label")}
		>
			<ul className="grid h-16" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
				{items.map(({ key, href, icon: Icon }) => {
					const active = isActivePath(pathname, href);

					if (key === "sell") {
						return (
							<li key={key} className="flex items-center justify-center">
								<Link
									href={href}
									aria-label={t(key)}
									className="brand-gradient touch-target -mt-6 flex size-14 items-center justify-center rounded-2xl text-primary-foreground shadow-lg ring-4 ring-background transition-transform active:scale-95"
								>
									<Icon className="size-6" />
								</Link>
							</li>
						);
					}

					return (
						<li key={key}>
							<Link
								href={href}
								aria-current={active ? "page" : undefined}
								className={cn(
									"touch-target relative flex h-full flex-col items-center justify-center gap-0.5 font-medium text-[11px]",
									active ? "text-primary" : "text-muted-foreground"
								)}
							>
								<Icon className="size-5" />
								{t(key)}
								{key === "notifications" && unread > 0 ? (
									<span className="absolute top-2.5 left-1/2 ml-1.5 size-2 rounded-full bg-danger" />
								) : null}
							</Link>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
