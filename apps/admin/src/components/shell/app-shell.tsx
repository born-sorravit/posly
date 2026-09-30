"use client";

import { Brand, SidebarNav } from "@/components/shell/nav";
import { Avatar, AvatarFallback, AvatarImage } from "@posly/ui/components/avatar";
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
import { nameInitial } from "@posly/utils/format";
import { LogOut, Menu, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { type ReactNode, useState } from "react";

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

function UserMenu({ user }: { user: AuthUser }) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon-lg" className="rounded-full" aria-label="บัญชี">
					<Avatar className="size-8">
						{user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
						<AvatarFallback>{nameInitial(user.name)}</AvatarFallback>
					</Avatar>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-60">
				<DropdownMenuLabel className="grid font-normal">
					<span className="truncate font-medium">{user.name}</span>
					<span className="truncate text-muted-foreground text-xs">{user.email}</span>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={signOut}>
					<LogOut />
					ออกจากระบบ
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** Rail from `desktop` (1280px) up; below that the header's menu button opens it as a sheet. */
export function AppShell({ user, children }: { user: AuthUser; children: ReactNode }) {
	const [open, setOpen] = useState(false);
	return (
		<div className="flex min-h-svh">
			<aside className="sticky top-0 hidden h-svh w-60 shrink-0 border-sidebar-border border-r bg-sidebar desktop:block">
				<div className="flex h-16 items-center px-4">
					<Brand />
				</div>
				<div className="px-3 py-2">
					<SidebarNav />
				</div>
			</aside>

			<div className="flex min-w-0 flex-1 flex-col">
				<header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur tablet:px-6">
					<Sheet open={open} onOpenChange={setOpen}>
						<SheetTrigger asChild>
							<Button variant="ghost" size="icon-lg" aria-label="เมนู" className="desktop:hidden">
								<Menu className="size-5" />
							</Button>
						</SheetTrigger>
						<SheetContent side="left" className="w-72 bg-sidebar p-0">
							<SheetTitle className="sr-only">เมนู</SheetTitle>
							<div className="flex h-16 items-center px-4">
								<Brand />
							</div>
							<div className="px-3 py-2">
								<SidebarNav onNavigate={() => setOpen(false)} />
							</div>
						</SheetContent>
					</Sheet>
					<div className="desktop:hidden">
						<Brand />
					</div>
					<div className="ml-auto flex items-center gap-1">
						<ThemeToggle />
						<UserMenu user={user} />
					</div>
				</header>
				<main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 tablet:px-6 tablet:py-8">{children}</main>
			</div>
		</div>
	);
}
