"use client";

import { cn } from "@/lib/utils";
import { useAttention } from "@/lib/use-attention";
import { Activity, BellRing, CreditCard, LayoutGrid, type LucideIcon, Server, Store, Users } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Grouped like apps/web's sidebar: untitled main group, then titled ones. */
const SECTIONS: { title?: string; items: { href: string; label: string; icon: LucideIcon }[] }[] = [
	{
		items: [
			{ href: "/", label: "ภาพรวม", icon: LayoutGrid },
			{ href: "/attention", label: "ต้องดูแล", icon: BellRing },
			{ href: "/businesses", label: "ร้านค้า", icon: Store },
			{ href: "/users", label: "ผู้ใช้", icon: Users },
			{ href: "/subscriptions", label: "Subscriptions", icon: CreditCard },
		],
	},
	{
		title: "ระบบ",
		items: [
			{ href: "/activity", label: "กิจกรรม", icon: Activity },
			{ href: "/system", label: "สถานะระบบ", icon: Server },
		],
	},
];

const isActive = (pathname: string, href: string) =>
	href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

/** The Posly mark and name, as apps/web's Brand, with "Admin" set quieter beside it. */
export function Brand({ onNavigate }: { onNavigate?: () => void }) {
	return (
		<Link
			href="/"
			onClick={onNavigate}
			className="flex min-w-0 items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
		>
			<span className="relative block size-9 shrink-0 overflow-hidden rounded-[25%]">
				<Image src="/icons/mark-96.png" alt="" fill sizes="96px" className="object-cover" priority />
			</span>
			<span className="truncate font-semibold text-lg tracking-tight">
				Posly <span className="font-normal text-muted-foreground">Admin</span>
			</span>
		</Link>
	);
}

export function SidebarNav({ onNavigate, layoutId = "sidebar-active" }: { onNavigate?: () => void; layoutId?: string }) {
	const pathname = usePathname();
	// Shops waiting on someone: the one number worth showing in the menu.
	const { total: attention } = useAttention();
	return (
		<nav className="grid gap-5">
			{SECTIONS.map((section, index) => (
				<div key={section.title ?? index} className="grid gap-0.5">
					{section.title ? (
						<p className="px-3 pb-1 font-medium text-muted-foreground/80 text-xs">{section.title}</p>
					) : null}
					{section.items.map(({ href, label, icon: Icon }) => {
						const active = isActive(pathname, href);
						return (
							<Link
								key={href}
								href={href}
								onClick={onNavigate}
								aria-current={active ? "page" : undefined}
								className={cn(
									// 44px on a phone (touch), 40px from tablet up.
									"group relative flex h-11 items-center gap-3 rounded-xl px-3 font-medium text-sm transition-colors duration-150 tablet:h-10",
									active ? "text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
								)}
							>
								{/* One shared pill slides between items, as in apps/web. */}
								{active ? (
									<motion.span
										layoutId={layoutId}
										aria-hidden
										className="absolute inset-0 rounded-xl bg-accent"
										transition={{ type: "spring", stiffness: 500, damping: 38 }}
									/>
								) : null}
								<Icon className={cn("relative size-[18px] shrink-0", active ? "text-primary" : "group-hover:text-foreground")} />
								<span className="relative truncate">{label}</span>
								{href === "/attention" && attention > 0 ? (
									<span className="numeric relative ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 font-semibold text-[11px] text-white">
										{attention > 99 ? "99+" : attention}
									</span>
								) : null}
							</Link>
						);
					})}
				</div>
			))}
		</nav>
	);
}
