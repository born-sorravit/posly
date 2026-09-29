import { ProductThumb } from "@/components/common/product-thumb";
import { formatBaht } from "@posly/utils/money";
import { cn } from "@/lib/utils";
import type { ProductArt } from "@posly/types/domain";
import { Banknote, Check, CreditCard, QrCode, Search, TrendingUp, TriangleAlert } from "lucide-react";
import { CountUp, DrawnChart, GrowBars } from "@/components/landing/motion";
import { getTranslations } from "next-intl/server";

/*
 * Product pictures for the landing page, built from the app's own pieces (product tiles,
 * tokens, money formatting) rather than screenshots — so they follow the theme, stay sharp
 * at any size, and cannot drift into showing a UI the app no longer has.
 *
 * The menu uses real photos, as a shop that has uploaded its own would look — one bright,
 * clean-background set so the grid reads as one menu. They are free Unsplash photos
 * (Unsplash License: commercial use, no attribution required), stored in /public/landing/menu
 * so the page never hotlinks. Sources, by Unsplash photo id: latte wB62PLxvQ3Y ·
 * americano 2Hu7Qnw6xlI · matcha 0P9En66EWzY · thai-tea hvxd8EeTUZU · croissant VzUE5RtCuBA ·
 * pistachio-cake xoeTLUi_XyA · iced-latte DTxxKUj5Xoc · iced-americano 87fHq2C24IU
 */

// Versioned names: replacing a photo must not be masked by a browser or image-optimizer cache.
const photo = (file: string) => `/landing/menu/${file}.v2.jpg`;

const MENU: { name: string; price: number; art: ProductArt; image: string }[] = [
	{ name: "Latte", price: 7000, art: "latte", image: photo("latte") },
	{ name: "Americano", price: 6000, art: "coffee", image: photo("americano") },
	{ name: "Matcha Latte", price: 7500, art: "matcha", image: photo("matcha") },
	{ name: "Thai Tea", price: 6500, art: "tea", image: photo("thai-tea") },
	{ name: "Croissant", price: 6500, art: "croissant", image: photo("croissant") },
	{ name: "Pistachio Cake", price: 9500, art: "cake", image: photo("pistachio-cake") },
	{ name: "Iced Latte", price: 7500, art: "latte", image: photo("iced-latte") },
	{ name: "Iced Americano", price: 6500, art: "coffee", image: photo("iced-americano") },
];

const CART = [
	{ name: "Latte", detail: "M · หวาน 50%", qty: 2, price: 8000, art: "latte" as const, image: photo("latte") },
	{ name: "Croissant", detail: "", qty: 1, price: 6500, art: "croissant" as const, image: photo("croissant") },
	{ name: "Thai Tea", detail: "L · หวาน 75%", qty: 1, price: 8500, art: "tea" as const, image: photo("thai-tea") },
];

function WindowFrame({ children, className }: { children: React.ReactNode; className?: string }) {
	return (
		<div className={cn("overflow-hidden rounded-2xl bg-background shadow-2xl ring-1 ring-foreground/10", className)}>
			<div className="flex h-9 items-center gap-1.5 border-border/60 border-b bg-muted/40 px-4">
				<span className="size-2.5 rounded-full bg-[#ff5f57]" />
				<span className="size-2.5 rounded-full bg-[#febc2e]" />
				<span className="size-2.5 rounded-full bg-[#28c840]" />
				<span className="mx-auto h-5 w-44 rounded-md bg-background/80 text-center text-[10px] text-muted-foreground leading-5">
					posly.app/pos
				</span>
			</div>
			{children}
		</div>
	);
}

/** The POS: menu grid on the left, the cart and its total on the right. */
export async function PosMockup() {
	const t = await getTranslations("landing.mock");
	const subtotal = CART.reduce((s, l) => s + l.price * l.qty, 0);
	const discount = 2000;
	return (
		<WindowFrame>
			{/* Phones get the app's phone layout: the menu full width, the cart as a bar below. */}
			<div className="grid gap-3 bg-muted/30 p-3 tablet:grid-cols-[1fr_240px]">
				<div className="min-w-0 space-y-2.5">
					<div className="flex h-8 items-center gap-2 rounded-lg bg-card px-2.5 text-[11px] text-muted-foreground shadow-sm">
						<Search className="size-3.5 shrink-0" />
						<span className="truncate">{t("search")}</span>
					</div>
					<div className="flex gap-1.5 overflow-hidden">
						{[t("all"), "กาแฟ", "ชา", "ขนม"].map((c, i) => (
							<span
								key={c}
								className={cn(
									"shrink-0 rounded-md px-2.5 py-1 font-medium text-[10px]",
									i === 0 ? "brand-gradient text-white" : "bg-card text-muted-foreground shadow-sm"
								)}
							>
								{c}
							</span>
						))}
					</div>
					<div className="grid grid-cols-3 gap-2 tablet:grid-cols-4 [&>*:nth-child(n+7)]:hidden tablet:[&>*:nth-child(n+7)]:block">
						{MENU.map((p) => (
							<div key={p.name} className="rounded-xl bg-card p-1.5 shadow-sm">
								<ProductThumb art={p.art} imageUrl={p.image} name={p.name} className="aspect-square w-full ring-1 ring-foreground/6" rounded="rounded-lg" />
								<p className="mt-1.5 truncate px-0.5 font-medium text-[10px]">{p.name}</p>
								<p className="numeric px-0.5 pb-0.5 text-[10px] text-muted-foreground">{formatBaht(p.price)}</p>
							</div>
						))}
					</div>
				</div>
				<div className="flex items-center gap-3 rounded-xl bg-card p-2.5 shadow-sm tablet:hidden">
					<div className="-space-x-2 flex">
						{CART.map((l) => (
							<ProductThumb
								key={l.name}
								art={l.art}
								imageUrl={l.image}
								name={l.name}
								className="size-8 ring-2 ring-card"
								rounded="rounded-full"
							/>
						))}
					</div>
					<div className="min-w-0 flex-1 leading-tight">
						<p className="text-[10px] text-muted-foreground">{t("cartItems", { count: CART.reduce((n, l) => n + l.qty, 0) })}</p>
						<p className="numeric font-bold text-sm">{formatBaht(subtotal - discount)}</p>
					</div>
					<span className="brand-gradient flex h-9 items-center rounded-lg px-4 font-semibold text-[11px] text-white">
						{t("pay")}
					</span>
				</div>
				<div className="hidden flex-col rounded-xl bg-card p-2.5 shadow-sm tablet:flex">
					<p className="font-semibold text-[11px]">{t("cart")}</p>
					<div className="mt-2 flex-1 space-y-2">
						{CART.map((l) => (
							<div key={l.name} className="flex items-center gap-2">
								<ProductThumb art={l.art} imageUrl={l.image} name={l.name} className="size-7 shrink-0" rounded="rounded-md" />
								<div className="min-w-0 flex-1">
									<p className="truncate font-medium text-[10px]">{l.name}</p>
									{l.detail ? <p className="truncate text-[9px] text-muted-foreground">{l.detail}</p> : null}
								</div>
								<span className="numeric text-[10px] text-muted-foreground">×{l.qty}</span>
							</div>
						))}
					</div>
					<div className="mt-3 space-y-1 border-border/60 border-t pt-2 text-[10px]">
						<div className="flex justify-between text-muted-foreground">
							<span>{t("subtotal")}</span>
							<span className="numeric">{formatBaht(subtotal)}</span>
						</div>
						<div className="flex justify-between text-success">
							<span>{t("discount")}</span>
							<span className="numeric">−{formatBaht(discount)}</span>
						</div>
						<div className="flex items-end justify-between pt-1">
							<span className="font-semibold">{t("total")}</span>
							<span className="numeric font-bold text-sm">{formatBaht(subtotal - discount)}</span>
						</div>
					</div>
					<div className="mt-2 grid grid-cols-3 gap-1">
						{[Banknote, QrCode, CreditCard].map((Icon, i) => (
							<span
								key={Icon.displayName ?? i}
								className={cn(
									"flex h-6 items-center justify-center rounded-md",
									i === 1 ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground"
								)}
							>
								<Icon className="size-3" />
							</span>
						))}
					</div>
					<span className="brand-gradient mt-2 flex h-8 items-center justify-center rounded-lg font-semibold text-[11px] text-white">
						{t("pay")} {formatBaht(subtotal - discount)}
					</span>
				</div>
			</div>
		</WindowFrame>
	);
}

/** A small sales card that floats over the hero picture. */
export async function SalesCard({ className }: { className?: string }) {
	const t = await getTranslations("landing.mock");
	const bars = [22, 30, 26, 48, 64, 52, 40, 58, 72, 60, 44, 36];
	return (
		<div className={cn("w-56 rounded-2xl bg-card p-4 shadow-xl ring-1 ring-foreground/8", className)}>
			<p className="text-muted-foreground text-xs">{t("todaySales")}</p>
			<CountUp value={12480} prefix="฿" className="numeric mt-1 block font-bold text-2xl tracking-tight" />
			<p className="mt-0.5 flex items-center gap-1 font-medium text-success text-xs">
				<TrendingUp className="size-3.5" />
				+18.2% <span className="font-normal text-muted-foreground">{t("vsYesterday")}</span>
			</p>
			<GrowBars heights={bars} highlight={8} className="mt-3 h-12" />
		</div>
	);
}

/** "Paid" and "running low" — the two things a shop wants to be told about. */
export async function ToastCards({ className }: { className?: string }) {
	const t = await getTranslations("landing.mock");
	return (
		<div className={cn("w-60 space-y-2", className)}>
			<div className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-xl ring-1 ring-foreground/8">
				<span className="flex size-8 items-center justify-center rounded-full bg-success text-white">
					<Check className="size-4" strokeWidth={3} />
				</span>
				<div className="text-xs">
					<p className="font-semibold">{t("paid")}</p>
					<p className="numeric text-muted-foreground">#003064 · PromptPay · ฿245</p>
				</div>
			</div>
			<div className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-xl ring-1 ring-foreground/8">
				<span className="flex size-8 items-center justify-center rounded-full bg-warning/15 text-warning">
					<TriangleAlert className="size-4" />
				</span>
				<div className="text-xs">
					<p className="font-semibold">
						Croissant · {t("lowStock")}
					</p>
					<p className="text-muted-foreground">{t("left", { count: 3 })}</p>
				</div>
			</div>
		</div>
	);
}

/** The dashboard side of the showcase: metric tiles over a sales curve. */
export async function DashboardMockup() {
	const t = await getTranslations("landing.mock");
	const points = [8, 12, 10, 22, 34, 28, 20, 30, 42, 36, 24, 18];
	const max = Math.max(...points);
	const path = points
		.map((p, i) => `${i === 0 ? "M" : "L"}${(i / (points.length - 1)) * 300},${100 - (p / max) * 88}`)
		.join(" ");
	return (
		<WindowFrame>
			<div className="space-y-3 bg-muted/30 p-4">
				<div className="grid grid-cols-3 gap-2">
					{[
						[t("todaySales"), "฿12,480", "+18%"],
						["ออเดอร์", "86", "+9%"],
						["เฉลี่ย/บิล", "฿145", "+4%"],
					].map(([label, value, delta]) => (
						<div key={label} className="rounded-xl bg-card p-3 shadow-sm">
							<p className="truncate text-[10px] text-muted-foreground">{label}</p>
							<p className="numeric mt-0.5 font-bold text-sm">{value}</p>
							<p className="numeric text-[10px] text-success">{delta}</p>
						</div>
					))}
				</div>
				<div className="rounded-xl bg-card p-3 shadow-sm">
					<DrawnChart line={path} area={`${path} L300,100 L0,100 Z`} />
					<div className="numeric mt-1 flex justify-between text-[9px] text-muted-foreground">
						{["08:00", "11:00", "14:00", "17:00", "20:00"].map((h) => (
							<span key={h}>{h}</span>
						))}
					</div>
				</div>
				<div className="space-y-1.5 rounded-xl bg-card p-3 shadow-sm">
					{(
						[
							["latte", "Latte", "latte", 42],
							["tea", "Thai Tea", "thai-tea", 31],
							["croissant", "Croissant", "croissant", 24],
						] as const
					).map(([art, name, file, n]) => (
						<div key={name} className="flex items-center gap-2 text-[11px]">
							<ProductThumb art={art} imageUrl={photo(file)} name={name} className="size-6" rounded="rounded-md" />
							<span className="flex-1 font-medium">{name}</span>
							<span className="block h-1.5 w-24 overflow-hidden rounded-full bg-muted">
								<span className="block h-full rounded-full bg-primary" style={{ width: `${(n / 42) * 100}%` }} />
							</span>
							<span className="numeric w-6 text-right text-muted-foreground">{n}</span>
						</div>
					))}
				</div>
			</div>
		</WindowFrame>
	);
}
