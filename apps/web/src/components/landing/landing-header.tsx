"use client";

import { DemoDialog } from "@/components/demo/demo-dialog";
import { Brand } from "@/components/layout/brand";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@posly/ui/components/button";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@posly/ui/components/sheet";
import { Link } from "@/i18n/navigation";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";
import { ArrowRight, type LucideIcon, Menu, Monitor, Moon, Sun, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const LINKS = [
	["features", "#features"],
	["how", "#how"],
	["pricing", "#pricing"],
	["faq", "#faq"],
] as const;

const THEMES: { value: "light" | "dark" | "system"; icon: LucideIcon; label: "themeLight" | "themeDark" | "themeSystem" }[] =
	[
		{ value: "light", icon: Sun, label: "themeLight" },
		{ value: "dark", icon: Moon, label: "themeDark" },
		{ value: "system", icon: Monitor, label: "themeSystem" },
	];

/**
 * Light / dark / system for the menu panel: one row, the label on the left and three icon
 * buttons on the right, each named for screen readers and in a tooltip-free title.
 */
function ThemeChoice() {
	const t = useTranslations("landing.nav");
	const { theme, setTheme } = useTheme();
	const current = theme ?? "system";
	return (
		<div className="flex items-center justify-between gap-4 pl-3">
			<span className="font-medium">{t("theme")}</span>
			<div role="radiogroup" aria-label={t("theme")} className="flex gap-0.5 rounded-full bg-muted p-1">
				{THEMES.map(({ value, icon: Icon, label }) => {
					const selected = current === value;
					return (
						<button
							key={value}
							type="button"
							role="radio"
							aria-checked={selected}
							aria-label={t(label)}
							title={t(label)}
							onClick={() => setTheme(value)}
							className={cn(
								"flex size-8 items-center justify-center rounded-full transition-colors",
								selected
									? "bg-background text-foreground shadow-sm dark:bg-white/12"
									: "text-muted-foreground hover:text-foreground"
							)}
						>
							<Icon className="size-4" aria-hidden />
						</button>
					);
				})}
			</div>
		</div>
	);
}

/**
 * Sticky top bar: transparent over the hero, a frosted bar once the page scrolls. Signed-in
 * visitors get "ไปที่ร้านของฉัน" instead of the sign-up pair.
 */
export function LandingHeader({ signedIn }: { signedIn: boolean }) {
	const t = useTranslations("landing.nav");
	const [scrolled, setScrolled] = useState(false);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 8);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	const actions = signedIn ? (
		<Button asChild className="brand-gradient">
			<Link href="/dashboard">
				{t("app")}
				<ArrowRight />
			</Link>
		</Button>
	) : (
		<>
			{env.demoEnabled ? (
				<DemoDialog>
					<Button variant="outline">{t("demo")}</Button>
				</DemoDialog>
			) : null}
			<Button asChild variant="ghost">
				<Link href="/login">{t("login")}</Link>
			</Button>
			<Button asChild className="brand-gradient">
				<Link href="/register">{t("signup")}</Link>
			</Button>
		</>
	);

	return (
		<header
			className={cn(
				"sticky top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-200",
				scrolled
					? // The ::before fills the strip above the bar: iOS in-app browsers (Telegram,
						// Instagram) scroll the page under their translucent top bar but pin `top-0`
						// below it, so without this the content shows through above the header.
						"bg-background/80 shadow-[0_1px_0_var(--border)] backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-40 before:bg-background before:content-['']"
					: "bg-transparent"
			)}
		>
			<div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 tablet:px-6">
				<Brand href="/" />
				<nav className="hidden items-center gap-1 desktop:flex">
					{LINKS.map(([key, href]) => (
						<a
							key={key}
							href={href}
							className="rounded-lg px-3 py-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
						>
							{t(key)}
						</a>
					))}
				</nav>
				<div className="ml-auto hidden items-center gap-2 desktop:flex">
					<ThemeToggle />
					{actions}
				</div>
				{/* Tablets keep the one main action in the bar; everything else is in the drawer. */}
				<Button asChild className="brand-gradient ml-auto hidden tablet:inline-flex desktop:hidden">
					<Link href={signedIn ? "/dashboard" : "/register"}>
						{signedIn ? t("app") : t("signup")}
						<ArrowRight />
					</Link>
				</Button>
				{/* Below desktop, links, theme and sign-in all live in the drawer. */}
				<Sheet open={open} onOpenChange={setOpen}>
					<SheetTrigger asChild>
						<Button
							variant="ghost"
							size="icon-lg"
							className="ml-auto tablet:-ml-3 desktop:hidden"
							aria-label={t("menu")}
						>
							<Menu className="size-5" />
						</Button>
					</SheetTrigger>
					<SheetContent side="right" showCloseButton={false} className="w-[84vw] max-w-sm gap-0 p-0">
						<SheetTitle className="sr-only">{t("menu")}</SheetTitle>
						<div className="flex h-16 shrink-0 items-center justify-between pr-3 pl-5">
							<Brand href="/" onNavigate={() => setOpen(false)} />
							<SheetClose asChild>
								<Button variant="ghost" size="icon-lg" aria-label={t("close")}>
									<X className="size-5" />
								</Button>
							</SheetClose>
						</div>

						<div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pt-2">
							<nav className="grid">
								{LINKS.map(([key, href]) => (
									<a
										key={key}
										href={href}
										onClick={() => setOpen(false)}
										className="flex h-12 items-center rounded-xl px-3 font-medium text-base transition-colors hover:bg-muted"
									>
										{t(key)}
									</a>
								))}
							</nav>

							<div className="mt-4 border-t pt-4">
								<ThemeChoice />
							</div>
						</div>

						{/* Pinned to the bottom, within thumb reach. */}
						<div className="grid shrink-0 gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
							{signedIn ? (
								<Button asChild size="lg" className="brand-gradient h-12 rounded-xl text-base">
									<Link href="/dashboard">
										{t("app")}
										<ArrowRight />
									</Link>
								</Button>
							) : (
								<>
									<Button asChild size="lg" className="brand-gradient h-12 rounded-xl text-base">
										<Link href="/register">
											{t("signup")}
											<ArrowRight />
										</Link>
									</Button>
									<div className={cn("grid gap-2", env.demoEnabled && "grid-cols-2")}>
										{env.demoEnabled ? (
											<DemoDialog>
												<Button variant="outline" size="lg" className="h-12 rounded-xl">
													{t("demo")}
												</Button>
											</DemoDialog>
										) : null}
										<Button asChild variant="outline" size="lg" className="h-12 rounded-xl">
											<Link href="/login">{t("login")}</Link>
										</Button>
									</div>
								</>
							)}
						</div>
					</SheetContent>
				</Sheet>
			</div>
		</header>
	);
}
