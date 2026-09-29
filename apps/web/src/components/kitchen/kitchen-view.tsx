"use client";

import { FeatureLocked } from "@/components/common/feature-locked";
import { SERVICE_ICON } from "@/components/pos/order-tag";
import type { ServiceType } from "@posly/types/domain";
import { Button } from "@posly/ui/components/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@posly/ui/components/sheet";
import { Skeleton } from "@posly/ui/components/skeleton";
import { useKitchenBoard, useKitchenMutations } from "@/hooks/use-posly";
import { useRealtime } from "@/components/realtime/realtime";
import { useNow } from "@/hooks/use-now";
import { useFeature } from "@/hooks/use-workspace";
import { TABLET_UP, useMediaQuery } from "@/hooks/use-media-query";
import type { KitchenStatus, KitchenTicketDto } from "@/lib/api/posly";
import { formatClock } from "@posly/utils/format";
import { cn } from "@/lib/utils";
import { ArrowRight, Bell, BellOff, Check, ChevronDown, History, RotateCcw, Undo2, WifiOff } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

const COLUMNS = ["NEW", "PREPARING", "READY"] as const;
const NEXT: Record<(typeof COLUMNS)[number], KitchenStatus> = { NEW: "PREPARING", PREPARING: "READY", READY: "SERVED" };
const PREV: Partial<Record<KitchenStatus, KitchenStatus>> = { PREPARING: "NEW", READY: "PREPARING" };
const ACTION: Record<(typeof COLUMNS)[number], "start" | "ready" | "serve"> = {
	NEW: "start",
	PREPARING: "ready",
	READY: "serve",
};
// There is no info token: chart-4 is the theme's sky blue.
const TONE: Record<(typeof COLUMNS)[number], string> = {
	NEW: "bg-chart-4",
	PREPARING: "bg-warning",
	READY: "bg-success",
};

const SOUND_KEY = "posly:kitchen-sound";
const soundListeners = new Set<() => void>();
const subscribeSound = (notify: () => void) => {
	soundListeners.add(notify);
	return () => soundListeners.delete(notify);
};
let soundFallback = false;
const readSound = () => {
	try {
		return localStorage.getItem(SOUND_KEY) === "on";
	} catch {
		return soundFallback;
	}
};
const writeSound = (on: boolean) => {
	try {
		localStorage.setItem(SOUND_KEY, on ? "on" : "off");
	} catch {
		// Private mode: the setting lasts for this visit only.
		soundFallback = on;
	}
	for (const notify of soundListeners) notify();
};

/** A short two-note chime, made on the spot — no audio file to load or cache. */
const chime = (context: AudioContext) => {
	const now = context.currentTime;
	for (const [i, freq] of [880, 1320].entries()) {
		const osc = context.createOscillator();
		const gain = context.createGain();
		osc.frequency.value = freq;
		osc.type = "sine";
		gain.gain.setValueAtTime(0.0001, now + i * 0.16);
		gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.16 + 0.02);
		gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.35);
		osc.connect(gain).connect(context.destination);
		osc.start(now + i * 0.16);
		osc.stop(now + i * 0.16 + 0.4);
	}
};

/** Minutes since the order was rung up: the one number a kitchen watches. */
function Elapsed({ since, now }: { since: string; now: Date }) {
	const t = useTranslations("kitchen");
	const minutes = Math.max(0, Math.floor((now.getTime() - new Date(since).getTime()) / 60_000));
	return (
		<span
			className={cn(
				"numeric rounded-md px-1.5 py-0.5 font-semibold text-xs",
				minutes >= 20 ? "bg-danger text-white" : minutes >= 10 ? "bg-warning/20 text-warning" : "text-muted-foreground"
			)}
			suppressHydrationWarning
		>
			{minutes < 1 ? t("justNow") : t("minutes", { count: minutes })}
		</span>
	);
}

function ServiceIcon({ type }: { type: ServiceType }) {
	const Icon = SERVICE_ICON[type];
	return <Icon className="size-3.5" />;
}

function Ticket({ ticket, now }: { ticket: KitchenTicketDto; now: Date }) {
	const t = useTranslations("kitchen");
	const tTag = useTranslations("pos.tag");
	const { setStatus, setPrepared } = useKitchenMutations();
	const column = ticket.status as (typeof COLUMNS)[number];
	const done = ticket.lines.filter((l) => l.preparedAt).length;
	const onError = (e: Error) => toast.error(e.message);
	const prev = PREV[ticket.status];

	return (
		<motion.article
			layout
			initial={{ opacity: 0, y: 12, scale: 0.98 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			exit={{ opacity: 0, scale: 0.96 }}
			transition={{ duration: 0.2 }}
			className="surface relative overflow-hidden rounded-2xl"
		>
			{/* Which column it is in, at a glance across the room. */}
			<span aria-hidden className={cn("absolute inset-y-4 left-0 w-[3px] rounded-r-full opacity-50", TONE[column])} />
			<header className="flex items-center gap-2 px-4 pt-3.5 pb-2">
				<span className="numeric font-bold text-base tracking-tight">#{ticket.number}</span>
				<span className="numeric text-muted-foreground text-xs" suppressHydrationWarning>
					{formatClock(ticket.createdAt)}
				</span>
				<span className="ml-auto">
					<Elapsed since={ticket.createdAt} now={now} />
				</span>
			</header>
			{ticket.serviceType || ticket.label || ticket.customerName ? (
				<div className="flex flex-wrap items-center gap-1.5 px-4 pb-1">
					{ticket.serviceType ? (
						<span
							className={cn(
								"flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-[11px]",
								ticket.serviceType === "DINE_IN"
									? "bg-chart-4/15 text-sky-700 dark:text-chart-4"
									: ticket.serviceType === "TAKEAWAY"
										? "bg-warning/15 text-amber-700 dark:text-warning"
										: "bg-primary/15 text-primary"
							)}
						>
							<ServiceIcon type={ticket.serviceType} />
							{tTag(ticket.serviceType)}
						</span>
					) : null}
					{ticket.label ? <span className="font-bold text-sm leading-none">{ticket.label}</span> : null}
					{ticket.customerName ? (
						<span className="ml-auto text-muted-foreground text-xs">{ticket.customerName}</span>
					) : null}
				</div>
			) : null}
			<ul className="px-2 pb-2" data-tour="kitchen-ticket">
				{ticket.lines.map((line) => {
					const ticked = line.preparedAt !== null;
					return (
						<li key={line.id}>
							<button
								type="button"
								onClick={() =>
									setPrepared.mutate({ orderId: ticket.id, itemId: line.id, prepared: !ticked }, { onError })
								}
								className="flex w-full items-start gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted/60 active:bg-muted"
							>
								<span
									className={cn(
										"mt-px flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
										ticked ? "border-success bg-success text-white" : "border-muted-foreground/30"
									)}
								>
									{ticked ? <Check className="size-3.5" strokeWidth={3} /> : null}
								</span>
								<span className={cn("min-w-0 flex-1", ticked && "text-muted-foreground line-through")}>
									<span className="flex items-baseline gap-2">
										<span className="numeric shrink-0 rounded-md bg-muted px-1.5 font-semibold text-xs leading-5">
											{line.quantity}×
										</span>
										<span className="font-medium text-sm leading-5">{line.name}</span>
									</span>
									{line.modifiers.length > 0 ? (
										<span className="mt-0.5 block text-muted-foreground text-xs">{line.modifiers.join(" · ")}</span>
									) : null}
									{line.note ? (
										<span className="mt-1 inline-block rounded-md bg-warning/15 px-1.5 py-0.5 font-medium text-amber-700 text-xs dark:text-warning">
											{line.note}
										</span>
									) : null}
								</span>
							</button>
						</li>
					);
				})}
			</ul>
			<footer className="space-y-2.5 border-t px-4 py-3">
				{/* How far the ticket is: fills as lines are ticked. */}
				<div className="flex items-center gap-2">
					<div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-success transition-[width] duration-300"
							style={{ width: `${ticket.lines.length ? (done / ticket.lines.length) * 100 : 0}%` }}
						/>
					</div>
					<span className="numeric text-muted-foreground text-xs">
						{done}/{ticket.lines.length}
					</span>
				</div>
				<div className="flex items-center gap-2">
					<span className="min-w-0 flex-1 truncate text-muted-foreground text-xs">
						{t("by", { name: ticket.employeeName })}
					</span>
					{prev ? (
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={t("back")}
							title={t("back")}
							onClick={() => setStatus.mutate({ orderId: ticket.id, status: prev }, { onError })}
						>
							<Undo2 />
						</Button>
					) : null}
					<Button
						size="sm"
						className={cn("h-8 rounded-lg", column === "PREPARING" ? "brand-gradient" : "")}
						variant={column === "PREPARING" ? "default" : "outline"}
						onClick={() => setStatus.mutate({ orderId: ticket.id, status: NEXT[column] }, { onError })}
					>
						{t(ACTION[column])}
						<ArrowRight />
					</Button>
				</div>
			</footer>
		</motion.article>
	);
}

/**
 * A column's scrolling list that says it scrolls: the edge fades where more is hidden, and a
 * "more below" pill jumps down. Neither shows when everything fits. The fade is a mask on the
 * list itself, so it works on the column's translucent background.
 */
function ScrollColumn({ children }: { children: ReactNode }) {
	const t = useTranslations("kitchen");
	const scroller = useRef<HTMLDivElement>(null);
	const content = useRef<HTMLDivElement>(null);
	const [edges, setEdges] = useState({ above: false, below: false });

	useEffect(() => {
		const el = scroller.current;
		if (!el) return;
		const update = () => {
			const above = el.scrollTop > 4;
			const below = el.scrollTop + el.clientHeight < el.scrollHeight - 4;
			setEdges((current) => (current.above === above && current.below === below ? current : { above, below }));
		};
		update();
		el.addEventListener("scroll", update, { passive: true });
		// Tickets arrive and leave without a scroll; re-measure when the list changes size.
		const observer = new ResizeObserver(update);
		observer.observe(el);
		if (content.current) observer.observe(content.current);
		return () => {
			el.removeEventListener("scroll", update);
			observer.disconnect();
		};
	}, []);

	const fade = 48;
	const mask = `linear-gradient(to bottom, ${edges.above ? "transparent" : "black"} 0, black ${edges.above ? fade : 0}px, black calc(100% - ${edges.below ? fade : 0}px), ${edges.below ? "transparent" : "black"} 100%)`;

	return (
		<div className="relative min-h-0 flex-1">
			<div
				ref={scroller}
				className="-mx-1 h-full overflow-y-auto px-1 pb-1"
				style={{ maskImage: mask, WebkitMaskImage: mask }}
			>
				<div ref={content} className="space-y-3">
					{children}
				</div>
			</div>
			{edges.below ? (
				<button
					type="button"
					onClick={() => scroller.current?.scrollBy({ top: scroller.current.clientHeight * 0.8, behavior: "smooth" })}
					className="-translate-x-1/2 absolute bottom-2 left-1/2 flex h-8 items-center gap-1 rounded-full bg-popover px-3 font-medium text-muted-foreground text-xs shadow-md ring-1 ring-border transition-colors hover:text-foreground"
				>
					<ChevronDown className="size-3.5" />
					{t("more")}
				</button>
			) : null}
		</div>
	);
}

/** Served in the last quarter hour, for when "served" was tapped on the wrong ticket. */
function RecentSheet({ tickets }: { tickets: KitchenTicketDto[] }) {
	const t = useTranslations("kitchen");
	const { setStatus } = useKitchenMutations();
	return (
		<Sheet>
			<SheetTrigger asChild>
				<Button variant="outline" size="lg" data-tour="kitchen-recent">
					<History />
					{t("recent")}
					{tickets.length ? <span className="numeric text-muted-foreground">{tickets.length}</span> : null}
				</Button>
			</SheetTrigger>
			<SheetContent className="gap-0 p-0 sm:max-w-md">
				<SheetHeader className="border-b px-5 py-4">
					<SheetTitle>{t("recent")}</SheetTitle>
					<SheetDescription className="sr-only">{t("recent")}</SheetDescription>
				</SheetHeader>
				<ul className="divide-y overflow-y-auto">
					{tickets.length === 0 ? (
						<li className="px-5 py-10 text-center text-muted-foreground text-sm">{t("recentEmpty")}</li>
					) : (
						tickets.map((ticket) => (
							<li key={ticket.id} className="flex items-center gap-3 px-5 py-3">
								<span className="min-w-0 flex-1">
									<span className="numeric block font-semibold">#{ticket.number}</span>
									<span className="block truncate text-muted-foreground text-xs">
										{ticket.lines.map((l) => `${l.quantity}× ${l.name}`).join(", ")}
									</span>
								</span>
								<Button
									variant="outline"
									size="sm"
									onClick={() =>
										setStatus.mutate(
											{ orderId: ticket.id, status: "READY" },
											{ onError: (e) => toast.error(e.message) }
										)
									}
								>
									<RotateCcw />
									{t("recall")}
								</Button>
							</li>
						))
					)}
				</ul>
			</SheetContent>
		</Sheet>
	);
}

/**
 * The kitchen screen (plan §27). Three columns a cook reads from across the room: new,
 * cooking, ready. Tick lines as they are done — the ticket moves by itself — and a chime
 * says when a new order lands. Built for a tablet on the wall, in fullscreen.
 */
export function KitchenView() {
	const t = useTranslations("kitchen");
	const enabled = useFeature("KITCHEN_DISPLAY");
	const board = useKitchenBoard(enabled);
	const live = useRealtime((s) => s.connected);
	const now = useNow(15_000);
	// Per device, read after hydration: the server has no idea what this tablet chose.
	const sound = useSyncExternalStore(subscribeSound, readSound, () => false);
	const audio = useRef<AudioContext | null>(null);
	const wide = useMediaQuery(TABLET_UP);
	// Only the columns someone folded or unfolded by hand; the rest follow "has tickets".
	const [openColumns, setOpenColumns] = useState<Partial<Record<(typeof COLUMNS)[number], boolean>>>({});
	const seen = useRef<Set<string> | null>(null);

	// A chime for tickets this screen has not seen before — never for the first load.
	useEffect(() => {
		const open = board.data?.open;
		if (!open) return;
		const ids = new Set(open.filter((ticket) => ticket.status === "NEW").map((ticket) => ticket.id));
		if (seen.current && sound && audio.current && [...ids].some((id) => !seen.current?.has(id))) {
			chime(audio.current);
		}
		seen.current = new Set([...(seen.current ?? []), ...ids]);
	}, [board.data, sound]);

	const toggleSound = () => {
		const next = !sound;
		// Browsers only let a page make sound after a tap; this tap is that permission.
		if (next) {
			audio.current ??= new AudioContext();
			void audio.current.resume();
			chime(audio.current);
		}
		writeSound(next);
	};

	if (!enabled) return <FeatureLocked title={t("lockedTitle")} hint={t("lockedHint")} action={t("upgrade")} />;

	const open = board.data?.open ?? [];
	return (
		// From tablet up the board is exactly the screen below the top bar, so each column scrolls
		// on its own and the headings stay put; a phone stacks the columns and scrolls the page.
		<div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4 tablet:h-[calc(100svh-4rem-var(--demo-banner-h,0px))] tablet:flex-none desktop:px-6">
			<div className="flex flex-wrap items-center gap-3">
				<h1 className="font-semibold text-2xl tracking-tight">{t("title")}</h1>
				{board.isError ? (
					<span className="flex items-center gap-1.5 text-danger text-sm">
						<WifiOff className="size-4" />
						{t("offline")}
					</span>
				) : (
					<span className="flex items-center gap-1.5 text-muted-foreground text-sm">
						<span className="relative flex size-2">
							{live ? (
								<span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
							) : null}
							<span className={cn("relative inline-flex size-2 rounded-full", live ? "bg-success" : "bg-warning")} />
						</span>
						{live ? t("live") : t("polling")}
					</span>
				)}
				<span className="text-muted-foreground text-sm">· {t("tapToTick")}</span>
				<div className="ml-auto flex gap-2">
					<Button
						variant="outline"
						size="lg"
						onClick={toggleSound}
						aria-pressed={sound}
						title={t("sound")}
						data-tour="kitchen-sound"
					>
						{sound ? <Bell /> : <BellOff />}
						{sound ? t("soundOn") : t("soundOff")}
					</Button>
					<RecentSheet tickets={board.data?.recent ?? []} />
				</div>
			</div>

			<div className="grid min-h-0 flex-1 content-start gap-4 tablet:grid-cols-3 tablet:grid-rows-[minmax(0,1fr)] tablet:content-stretch">
				{COLUMNS.map((column) => {
					const tickets = open.filter((ticket) => ticket.status === column);
					// A phone stacks the columns, so each folds away; an empty one starts folded.
					const expanded = wide || (openColumns[column] ?? tickets.length > 0);
					const heading = (
						<>
							<span className={cn("size-2.5 rounded-full", TONE[column])} />
							{t(`columns.${column}`)}
							<span className="numeric ml-auto rounded-full bg-card px-2.5 py-0.5 text-sm shadow-xs">
								{tickets.length}
							</span>
						</>
					);
					const body = board.isPending ? (
						<Skeleton className="h-40 rounded-2xl" />
					) : tickets.length === 0 ? (
						<p className="px-2 py-10 text-center text-muted-foreground text-sm">{t(`empty.${column}`)}</p>
					) : (
						<AnimatePresence initial={false} mode="popLayout">
							{tickets.map((ticket) => (
								<Ticket key={ticket.id} ticket={ticket} now={now} />
							))}
						</AnimatePresence>
					);
					return (
						<section key={column} className="flex min-h-0 flex-col rounded-3xl bg-muted/40 p-3">
							{/* The tour points at the first column's heading: the whole board is taller than the screen. */}
							{wide ? (
								<h2 className="mb-3 flex items-center gap-2 px-1 font-semibold" data-tour="kitchen-columns">
									{heading}
								</h2>
							) : (
								<h2 data-tour="kitchen-columns">
									<button
										type="button"
										aria-expanded={expanded}
										onClick={() => setOpenColumns((current) => ({ ...current, [column]: !expanded }))}
										className="flex w-full items-center gap-2 rounded-xl px-1 py-0.5 text-left font-semibold"
									>
										{heading}
										<motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
											<ChevronDown className="size-4 text-muted-foreground" />
										</motion.span>
									</button>
								</h2>
							)}
							{wide ? (
								<ScrollColumn>{body}</ScrollColumn>
							) : (
								<AnimatePresence initial={false}>
									{expanded ? (
										<motion.div
											key="body"
											initial={{ height: 0, opacity: 0 }}
											animate={{ height: "auto", opacity: 1 }}
											exit={{ height: 0, opacity: 0 }}
											transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
											className="overflow-hidden"
										>
											<div className="space-y-3 pt-3">{body}</div>
										</motion.div>
									) : null}
								</AnimatePresence>
							)}
						</section>
					);
				})}
			</div>
		</div>
	);
}
