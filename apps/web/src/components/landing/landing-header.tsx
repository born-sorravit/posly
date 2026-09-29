"use client";

import { Brand } from "@/components/layout/brand";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@posly/ui/components/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@posly/ui/components/sheet";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { ArrowRight, Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

const LINKS = [
	["features", "#features"],
	["how", "#how"],
	["pricing", "#pricing"],
	["faq", "#faq"],
] as const;

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
				scrolled ? "bg-background/80 shadow-[0_1px_0_var(--border)] backdrop-blur-xl" : "bg-transparent"
			)}
		>
			<div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 tablet:px-6">
				<Brand />
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
				<div className="ml-auto hidden items-center gap-2 tablet:flex">
					<ThemeToggle />
					{actions}
				</div>
				<Sheet open={open} onOpenChange={setOpen}>
					<SheetTrigger asChild>
						<Button variant="ghost" size="icon-lg" className="ml-auto tablet:hidden" aria-label={t("menu")}>
							<Menu className="size-5" />
						</Button>
					</SheetTrigger>
					<SheetContent side="right" className="w-72 p-6">
						<SheetTitle className="sr-only">{t("menu")}</SheetTitle>
						<nav className="mt-8 grid gap-1">
							{LINKS.map(([key, href]) => (
								<a
									key={key}
									href={href}
									onClick={() => setOpen(false)}
									className="rounded-lg px-3 py-2.5 font-medium hover:bg-muted"
								>
									{t(key)}
								</a>
							))}
						</nav>
						<div className="mt-6 grid gap-2 [&>a]:w-full">{actions}</div>
					</SheetContent>
				</Sheet>
			</div>
		</header>
	);
}
