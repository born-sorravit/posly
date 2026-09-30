"use client";

import { cn } from "@/lib/utils";
import { Activity, CreditCard, LayoutDashboard, type LucideIcon, Server, Store, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
	{ href: "/", label: "ภาพรวม", icon: LayoutDashboard },
	{ href: "/businesses", label: "ร้านค้า", icon: Store },
	{ href: "/users", label: "ผู้ใช้", icon: Users },
	{ href: "/subscriptions", label: "Subscriptions", icon: CreditCard },
	{ href: "/activity", label: "กิจกรรม", icon: Activity },
	{ href: "/system", label: "ระบบ", icon: Server },
];

const isActive = (pathname: string, href: string) =>
	href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

export function Brand() {
	return (
		<Link href="/" className="flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
			<span className="relative block size-9 shrink-0 overflow-hidden rounded-[25%]">
				<Image src="/icons/mark-96.png" alt="" fill sizes="96px" className="object-cover" priority />
			</span>
			<span className="font-semibold text-lg tracking-tight">
				Posly <span className="font-normal text-muted-foreground">Admin</span>
			</span>
		</Link>
	);
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
	const pathname = usePathname();
	return (
		<nav className="grid gap-0.5">
			{NAV.map(({ href, label, icon: Icon }) => {
				const active = isActive(pathname, href);
				return (
					<Link
						key={href}
						href={href}
						onClick={onNavigate}
						aria-current={active ? "page" : undefined}
						className={cn(
							"flex h-10 items-center gap-3 rounded-xl px-3 font-medium text-sm transition-colors",
							active
								? "bg-accent text-accent-foreground"
								: "text-muted-foreground hover:bg-muted hover:text-foreground"
						)}
					>
						<Icon className={cn("size-[18px] shrink-0", active && "text-primary")} />
						<span className="truncate">{label}</span>
					</Link>
				);
			})}
		</nav>
	);
}
