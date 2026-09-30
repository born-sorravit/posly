"use client";

import { AdminUserProvider } from "@/components/shell/admin-user";
import { Brand, SidebarNav } from "@/components/shell/nav";
import { SearchMenu } from "@/components/shell/search-menu";
import { Button } from "@posly/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@posly/ui/components/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@posly/ui/components/sheet";
import type { AuthUser } from "@posly/types/api";
import { formatClock, formatThaiDate, nameColorIndex, nameInitial } from "@posly/utils/format";
import { cn } from "@/lib/utils";
import { ChevronDown, LogOut, Menu, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { type ReactNode, useEffect, useState } from "react";

export async function signOut() {
	await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
	// A full load on purpose: the server layout must re-read the session cookies.
	// eslint-disable-next-line @next/next/no-location-assign-relative-destination
	window.location.assign("/login");
}

function ThemeToggle() {
	const { resolvedTheme, setTheme } = useTheme();
	return (
		<Button
			variant="ghost"
			size="icon-lg"
			aria-label="สลับธีม"
			onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
			className="text-muted-foreground hover:text-foreground"
		>
			<Moon className="size-5 dark:hidden" />
			<Sun className="hidden size-5 dark:block" />
		</Button>
	);
}

/** Same gradients as apps/web's UserAvatar: one colour per person, picked from the name. */
const AVATAR_COLORS = [
	"from-indigo-500 to-violet-600",
	"from-sky-500 to-blue-600",
	"from-teal-500 to-emerald-600",
	"from-rose-500 to-pink-600",
	"from-amber-500 to-orange-600",
	"from-fuchsia-500 to-purple-600",
	"from-cyan-500 to-teal-600",
	"from-lime-600 to-green-700",
] as const;

function UserAvatar({ name, className }: { name: string; className?: string }) {
	return (
		<span
			className={cn(
				"flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-medium text-sm text-white",
				AVATAR_COLORS[nameColorIndex(name, AVATAR_COLORS.length)],
				className
			)}
			aria-hidden
		>
			{nameInitial(name)}
		</span>
	);
}

/** `row` for the sidebar foot, `avatar` for the header below desktop — as in apps/web. */
function UserMenu({ user, variant }: { user: AuthUser; variant: "row" | "avatar" }) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					aria-label="บัญชี"
					className={cn(
						"flex items-center gap-3 rounded-xl text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
						variant === "row" ? "w-full p-2" : "rounded-full p-0.5"
					)}
				>
					<UserAvatar name={user.name} />
					{variant === "row" ? (
						<>
							<span className="min-w-0 flex-1">
								<span className="block truncate font-medium text-sm leading-tight">{user.name}</span>
								<span className="block truncate text-muted-foreground text-xs">ผู้ดูแลแพลตฟอร์ม</span>
							</span>
							<ChevronDown className="size-4 shrink-0 text-muted-foreground" />
						</>
					) : null}
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align={variant === "row" ? "start" : "end"} side={variant === "row" ? "top" : "bottom"} className="w-60">
				<DropdownMenuLabel className="grid font-normal">
					<span className="truncate font-medium">{user.name}</span>
					<span className="truncate text-muted-foreground text-xs">{user.email}</span>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={signOut} variant="destructive">
					<LogOut />
					ออกจากระบบ
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function Clock() {
	// Server and client differ by the render's moment; like apps/web's header, the element
	// says so rather than hiding the clock until mount.
	const [now, setNow] = useState(() => new Date());
	useEffect(() => {
		const id = setInterval(() => setNow(new Date()), 30_000);
		return () => clearInterval(id);
	}, []);
	return (
		<div className="hidden flex-col items-end whitespace-nowrap leading-tight desktop:flex">
			<span className="numeric font-semibold text-sm" suppressHydrationWarning>
				{formatClock(now)}
			</span>
			<span className="text-muted-foreground text-xs" suppressHydrationWarning>
				{formatThaiDate(now)}
			</span>
		</div>
	);
}

/**
 * The same shell as apps/web: a persistent rail from `desktop` (1280px) with the person at
 * its foot; below that a frosted top bar whose menu button opens the rail as a sheet.
 */
export function AppShell({ user, children }: { user: AuthUser; children: ReactNode }) {
	const [open, setOpen] = useState(false);
	return (
		<AdminUserProvider user={user}>
		<div className="flex min-h-svh">
			<aside className="sticky top-0 hidden h-svh w-64 shrink-0 border-sidebar-border border-r bg-sidebar desktop:block">
				<div className="flex h-full min-h-0 flex-col">
					<div className="flex h-16 items-center px-4">
						<Brand />
					</div>
					<div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
						<SidebarNav />
					</div>
					<div className="surface m-2 grid gap-1 rounded-2xl p-1.5">
						<UserMenu user={user} variant="row" />
					</div>
				</div>
			</aside>

			<div className="flex min-w-0 flex-1 flex-col">
				{/* ::before fills the strip above the bar: iOS in-app browsers scroll the page under
				    their own top bar but pin top-0 below it (DESIGN.md). */}
				<header className="sticky top-0 z-30 flex h-16 items-center gap-2 bg-background/70 px-4 backdrop-blur-xl backdrop-saturate-150 before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-40 before:bg-background before:content-[''] tablet:gap-3 desktop:pr-6 desktop:pl-6">
					<Sheet open={open} onOpenChange={setOpen}>
						<SheetTrigger asChild>
							<Button variant="ghost" size="icon-lg" aria-label="เมนู" className="desktop:hidden">
								<Menu className="size-5" />
							</Button>
						</SheetTrigger>
						<SheetContent side="left" className="w-[84vw] max-w-xs bg-sidebar p-0" showCloseButton={false}>
							<SheetTitle className="sr-only">เมนู</SheetTitle>
							<div className="flex h-16 items-center px-4">
								<Brand onNavigate={() => setOpen(false)} />
							</div>
							<div className="px-3 py-2">
								<SidebarNav onNavigate={() => setOpen(false)} layoutId="sheet-active" />
							</div>
						</SheetContent>
					</Sheet>
					<div className="min-w-0 tablet:hidden">
						<Brand />
					</div>
					<SearchMenu />
					{/* On a phone the search icon above takes the free space; from tablet this does. */}
					<div className="flex items-center gap-1 tablet:ml-auto tablet:gap-2">
						<Clock />
						<ThemeToggle />
						<div className="desktop:hidden">
							<UserMenu user={user} variant="avatar" />
						</div>
					</div>
				</header>
				<main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 desktop:px-8 desktop:py-8">{children}</main>
			</div>
		</div>
		</AdminUserProvider>
	);
}
