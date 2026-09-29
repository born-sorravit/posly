"use client";

import { BrandMark } from "@/components/layout/brand";
import { NAV_PERMISSION } from "@/components/layout/nav-items";
import { useSession } from "@/components/providers/session-provider";
import { Button } from "@posly/ui/components/button";
import { useActiveBusiness } from "@/hooks/use-workspace";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
	markTourSeen,
	pageTourFor,
	shouldAutoStartPageTour,
	shouldAutoStartTour,
	type TourId,
	useTourStore,
} from "@/stores/tour-store";
import { ArrowLeft, ArrowRight, CircleHelp, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type TourMessages = (typeof import("@/../messages/th.json"))["tour"];
type PageMessages = TourMessages["pages"];
/** A step's message path under `tour`: "steps.pos" for the app tour, "pages.pos.grid" for a page's. */
type StepKey =
	| `steps.${keyof TourMessages["steps"]}`
	| { [P in keyof PageMessages]: `pages.${P}.${keyof PageMessages[P] & string}` }[keyof PageMessages];

interface TourStep {
	key: StepKey;
	/** `data-tour` value of the element to point at; none for the welcome and finish cards. */
	target?: string;
	/** Only for people who can open what the step describes. */
	permission?: string;
}

/**
 * A minute's walk through the shop, in the order a new owner meets it: sell, set up the
 * menu, watch stock and sales, bring in staff, then the shortcuts. Steps for pages the
 * member cannot open are dropped, so a cashier gets a shorter, relevant tour.
 */
const APP_STEPS: TourStep[] = [
	{ key: "steps.welcome" },
	{ key: "steps.pos", target: "nav-pos", permission: NAV_PERMISSION.pos },
	{ key: "steps.products", target: "nav-products", permission: NAV_PERMISSION.products },
	{ key: "steps.inventory", target: "nav-inventory", permission: NAV_PERMISSION.inventory },
	{ key: "steps.orders", target: "nav-orders", permission: NAV_PERMISSION.orders },
	{ key: "steps.reports", target: "nav-reports", permission: NAV_PERMISSION.reports },
	{ key: "steps.employees", target: "nav-employees", permission: NAV_PERMISSION.employees },
	{ key: "steps.search", target: "search" },
	{ key: "steps.store", target: "store" },
	{ key: "steps.help", target: "user-menu" },
	{ key: "steps.done" },
];

/** One page each, pointing at that page's own controls. */
const TOURS: Record<TourId, TourStep[]> = {
	app: APP_STEPS,
	pos: [
		{ key: "pages.pos.search", target: "pos-search" },
		{ key: "pages.pos.categories", target: "pos-categories" },
		{ key: "pages.pos.grid", target: "pos-grid" },
		{ key: "pages.pos.customer", target: "pos-customer", permission: "customers:write" },
		{ key: "pages.pos.cart", target: "pos-cart" },
		{ key: "pages.pos.checkout", target: "pos-checkout" },
	],
	products: [
		{ key: "pages.products.add", target: "products-add", permission: "products:write" },
		{ key: "pages.products.list", target: "products-list" },
		{ key: "pages.products.modifiers", target: "nav-modifiers", permission: NAV_PERMISSION.modifiers },
	],
	inventory: [
		{ key: "pages.inventory.status", target: "inventory-status" },
		{ key: "pages.inventory.adjust", target: "inventory-adjust" },
		{ key: "pages.inventory.history", target: "inventory-history" },
	],
	orders: [
		{ key: "pages.orders.list", target: "orders-list" },
		{ key: "pages.orders.export", target: "orders-export" },
	],
	reports: [
		{ key: "pages.reports.range", target: "reports-range" },
		{ key: "pages.reports.tabs", target: "reports-tabs" },
		{ key: "pages.reports.profit", target: "reports-profit" },
	],
	kitchen: [
		{ key: "pages.kitchen.board", target: "kitchen-columns" },
		// The first ticket on the board; with none, the step is shown mid-screen.
		{ key: "pages.kitchen.tick", target: "kitchen-ticket" },
		{ key: "pages.kitchen.sound", target: "kitchen-sound" },
		{ key: "pages.kitchen.recent", target: "kitchen-recent" },
		{ key: "pages.kitchen.categories", target: "nav-categories", permission: NAV_PERMISSION.categories },
	],
	modifiers: [
		{ key: "pages.modifiers.add", target: "modifiers-add" },
		{ key: "pages.modifiers.list", target: "modifiers-list" },
		{ key: "pages.modifiers.attach", target: "nav-products", permission: NAV_PERMISSION.products },
	],
	customers: [
		{ key: "pages.customers.add", target: "customers-add" },
		{ key: "pages.customers.list", target: "customers-list" },
		{ key: "pages.customers.pos", target: "nav-pos", permission: NAV_PERMISSION.pos },
	],
	expenses: [
		{ key: "pages.expenses.add", target: "expenses-add" },
		{ key: "pages.expenses.summary", target: "expenses-summary" },
		{ key: "pages.expenses.list", target: "expenses-list" },
		{ key: "pages.expenses.profit", target: "nav-reports", permission: NAV_PERMISSION.reports },
	],
};

const GAP = 14;
const PAD = 6;
const CARD_W = 340;

/** The first on-screen element with this `data-tour` — the rail and the tablet sheet share markup. */
const findTarget = (name: string) =>
	[...document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)].find((el) => {
		const r = el.getBoundingClientRect();
		return r.width > 0 && r.height > 0;
	}) ?? null;

type Place = { top: number; left: number; side: "right" | "bottom" | "top" | "center" };

/** Beside the target when there is room (the sidebar), else below or above it, kept on screen. */
const placeCard = (rect: DOMRect | null, cardH: number): Place => {
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const w = Math.min(CARD_W, vw - 32);
	if (!rect) return { top: (vh - cardH) / 2, left: (vw - w) / 2, side: "center" };
	const clampTop = (t: number) => Math.min(Math.max(16, t), vh - cardH - 16);
	const clampLeft = (l: number) => Math.min(Math.max(16, l), vw - w - 16);
	if (rect.right + GAP + w <= vw - 16) {
		return { top: clampTop(rect.top + rect.height / 2 - cardH / 2), left: rect.right + GAP, side: "right" };
	}
	if (rect.bottom + GAP + cardH <= vh - 16) {
		return { top: rect.bottom + GAP, left: clampLeft(rect.left), side: "bottom" };
	}
	return { top: clampTop(rect.top - GAP - cardH), left: clampLeft(rect.left), side: "top" };
};

/**
 * The guided tour: a spotlight cut out of a dimmed page around one control, and a card
 * that says what it is for. Arrow keys step, Esc closes. It opens by itself once, after a
 * new shop is set up, and again whenever "แนะนำการใช้งาน" is chosen.
 */
export function ProductTour() {
	const t = useTranslations("tour");
	const open = useTourStore((s) => s.open);
	const tour = useTourStore((s) => s.tour);
	const start = useTourStore((s) => s.start);
	const stop = useTourStore((s) => s.stop);
	const { user } = useSession();
	const { can } = useActiveBusiness();
	const router = useRouter();

	const pathname = usePathname();
	const steps = useMemo(() => TOURS[tour].filter((s) => !s.permission || can(s.permission)), [tour, can]);
	const index = useTourStore((s) => s.index);
	const go = useTourStore((s) => s.go);
	const [rect, setRect] = useState<DOMRect | null>(null);
	const [cardH, setCardH] = useState(220);
	const [card, setCard] = useState<HTMLDivElement | null>(null);
	const step = steps[Math.min(index, steps.length - 1)];

	// First visit after onboarding. A beat of delay lets the page settle under the spotlight.
	useEffect(() => {
		if (!user || !shouldAutoStartTour(user.id)) return;
		const timer = setTimeout(start, 700);
		return () => clearTimeout(timer);
	}, [user, start]);

	// A page's own tour on the first visit to it. Longer delay: its data has to load first.
	const pageTour = pageTourFor(pathname);
	useEffect(() => {
		if (!user || !pageTour || useTourStore.getState().open) return;
		if (!shouldAutoStartPageTour(user.id, pageTour)) return;
		const timer = setTimeout(() => {
			if (!useTourStore.getState().open) start(pageTour);
		}, 1200);
		return () => clearTimeout(timer);
	}, [user, pageTour, start]);

	const close = useCallback(() => {
		if (user) markTourSeen(user.id, tour);
		stop();
	}, [user, tour, stop]);

	// Follow the target through resizes, scrolling and the sidebar collapsing.
	useLayoutEffect(() => {
		if (!open || !step) return;
		const measure = () => {
			const el = step.target ? findTarget(step.target) : null;
			if (el) el.scrollIntoView({ block: "nearest" });
			setRect(el ? el.getBoundingClientRect() : null);
		};
		// Measured on the next frame: the target may be mid-animation (sidebar, sheet) now.
		const frame = requestAnimationFrame(measure);
		window.addEventListener("resize", measure);
		window.addEventListener("scroll", measure, true);
		const interval = setInterval(measure, 400);
		return () => {
			window.removeEventListener("resize", measure);
			window.removeEventListener("scroll", measure, true);
			clearInterval(interval);
			cancelAnimationFrame(frame);
		};
	}, [open, step]);

	// The card's height decides where it fits; it changes with each step's text.
	useEffect(() => {
		if (!card) return;
		const observer = new ResizeObserver(([entry]) => setCardH(entry.contentRect.height + 40));
		observer.observe(card);
		return () => observer.disconnect();
	}, [card]);

	const last = index >= steps.length - 1;
	const next = useCallback(() => (last ? close() : go(index + 1)), [last, close, go, index]);
	const back = useCallback(() => go(Math.max(0, index - 1)), [go, index]);

	useEffect(() => {
		if (!open) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") close();
			else if (event.key === "ArrowRight" || event.key === "Enter") next();
			else if (event.key === "ArrowLeft") back();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, close, next, back]);

	if (!open || !step || typeof document === "undefined") return null;

	const place = placeCard(rect, cardH);
	// The centred, logo-topped card is for the app tour's welcome and finish. A page step whose
	// control is not on screen (a phone hides the cart) sits mid-screen but reads like any step.
	const hero = !step.target;
	// Welcome and finish are about the whole app; the rest point at one control.
	const counted = steps.filter((s) => s.target);
	const position = step.target ? counted.indexOf(step) + 1 : 0;

	return createPortal(
		<div className="fixed inset-0 z-[100]" role="dialog" aria-modal aria-labelledby="tour-title">
			{/* The dimmer is the spotlight's shadow, so the target stays clickable-looking and sharp. */}
			{rect ? (
				<motion.div
					aria-hidden
					className="pointer-events-none fixed rounded-xl ring-2 ring-primary"
					style={{ boxShadow: "0 0 0 9999px oklch(0.12 0.02 270 / 0.62)" }}
					initial={false}
					animate={{
						top: rect.top - PAD,
						left: rect.left - PAD,
						width: rect.width + PAD * 2,
						height: rect.height + PAD * 2,
					}}
					transition={{ type: "spring", stiffness: 420, damping: 38 }}
				/>
			) : (
				<div aria-hidden className="fixed inset-0 bg-[oklch(0.12_0.02_270/0.62)] backdrop-blur-[2px]" />
			)}
			{/* Clicks outside the card do nothing: a tour closed by a stray tap is a tour missed. */}
			<div className="fixed inset-0" />

			<AnimatePresence mode="wait">
				<motion.div
					key={`${tour}:${step.key}`}
					ref={setCard}
					initial={{ opacity: 0, y: 6 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.16 }}
					className={cn(
						"fixed rounded-2xl bg-popover p-5 text-popover-foreground shadow-2xl ring-1 ring-foreground/10",
						hero && "px-8 text-center"
					)}
					style={{ top: place.top, left: place.left, width: Math.min(CARD_W, window.innerWidth - 32) }}
				>
					<button
						type="button"
						onClick={close}
						aria-label={t("skip")}
						className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
					>
						<X className="size-4" />
					</button>

					{hero ? <BrandMark className="mx-auto mb-4 size-14 rounded-2xl" /> : null}
					{position ? (
						<p className="mb-1.5 font-medium text-primary text-xs">
							{t("counter", { step: position, total: counted.length })}
						</p>
					) : null}
					<h2 id="tour-title" className={cn("font-semibold text-base", !hero && "pr-8")}>
						{t(`${step.key}.title`)}
					</h2>
					<p className="mt-1.5 text-muted-foreground text-sm leading-relaxed">{t(`${step.key}.body`)}</p>

					<div className={cn("mt-5 flex items-center gap-2", hero ? "justify-center" : "justify-between")}>
						{index === 0 && tour === "app" ? (
							<Button variant="ghost" size="sm" onClick={close} className="text-muted-foreground">
								{t("skip")}
							</Button>
						) : index === 0 || (last && tour === "app") ? (
							<span />
						) : (
							<Button variant="ghost" size="sm" onClick={back} className="text-muted-foreground">
								<ArrowLeft />
								{t("back")}
							</Button>
						)}
						{last && tour !== "app" ? (
							<Button size="sm" className="brand-gradient" onClick={close}>
								{t("gotIt")}
							</Button>
						) : last ? (
							<>
								<Button variant="outline" size="sm" onClick={close}>
									{t("close")}
								</Button>
								{can("pos:use") ? (
									<Button
										size="sm"
										className="brand-gradient"
										onClick={() => {
											close();
											router.push("/pos");
										}}
									>
										{t("openPos")}
										<ArrowRight />
									</Button>
								) : null}
							</>
						) : (
							<Button size="sm" className="brand-gradient" onClick={next}>
								{index === 0 && tour === "app" ? t("start") : t("next")}
								<ArrowRight />
							</Button>
						)}
					</div>
				</motion.div>
			</AnimatePresence>
		</div>,
		document.body
	);
}

/** The header's "?" on a page that has its own tour; nothing elsewhere. */
export function PageTourButton() {
	const t = useTranslations("tour");
	const pathname = usePathname();
	const start = useTourStore((s) => s.start);
	const tour = pageTourFor(pathname);
	if (!tour) return null;
	return (
		<Button variant="ghost" size="icon-lg" onClick={() => start(tour)} aria-label={t("pageHelp")} title={t("pageHelp")}>
			<CircleHelp className="size-5" />
		</Button>
	);
}
