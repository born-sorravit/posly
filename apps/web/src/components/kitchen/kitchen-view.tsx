"use client";

import { FeatureLocked } from "@/components/common/feature-locked";
import { TicketSkeleton } from "@/components/common/page-skeletons";
import { SERVICE_ICON } from "@/components/pos/order-tag";
import type { ServiceType } from "@posly/types/domain";
import { Button } from "@posly/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@posly/ui/components/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@posly/ui/components/sheet";
import { Skeleton } from "@posly/ui/components/skeleton";
import { useKitchenBoard, useKitchenMutations } from "@/hooks/use-posly";
import { useRealtime } from "@/components/realtime/realtime";
import { useNow } from "@/hooks/use-now";
import { useFeature } from "@/hooks/use-workspace";
import { TABLET_UP, useMediaQuery } from "@/hooks/use-media-query";
import type { KitchenStatus, KitchenTicketDto } from "@/lib/api/posly";
import { formatClock } from "@posly/utils/format";
import { TONES, type Tone, play } from "@/lib/sounds";
import { cn } from "@/lib/utils";
import { ArrowRight, Bell, BellOff, Check, ChefHat, ChevronDown, History, Loader2, RotateCcw, Undo2, Volume2, WifiOff } from "lucide-react";
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
type SoundSetting = Tone | "off";

let soundFallback: SoundSetting = "off";
/** Stored per device. "on" is what the old on/off switch wrote; it meant the chime. */
const readSound = (): SoundSetting => {
	try {
		const raw = localStorage.getItem(SOUND_KEY);
		if (raw === "on") return "chime";
		return (TONES as readonly string[]).includes(raw ?? "") ? (raw as Tone) : "off";
	} catch {
		return soundFallback;
	}
};
const writeSound = (setting: SoundSetting) => {
	try {
		localStorage.setItem(SOUND_KEY, setting);
	} catch {
		// Private mode: the setting lasts for this visit only.
		soundFallback = setting;
	}
	for (const notify of soundListeners) notify();
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
	// A table tab sends rounds onto one ticket: each gets a heading, and the wait is the latest round's.
	const lastRound = Math.max(1, ...ticket.lines.map((l) => l.round));
	const waitingSince = lastRound > 1 ? ticket.updatedAt : ticket.createdAt;

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
					<Elapsed since={waitingSince} now={now} />
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
				{ticket.lines.map((line, index) => {
					const ticked = line.preparedAt !== null;
					const startsRound = lastRound > 1 && line.round !== ticket.lines[index - 1]?.round;
					return (
						<li key={line.id} className={cn(line.round < lastRound && ticked && "opacity-60")}>
							{startsRound ? (
								<p className="px-2 pt-2 pb-0.5 font-semibold text-muted-foreground text-xs">
									{t("round", { round: line.round })}
								</p>
							) : null}
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
	const tTag = useTranslations("pos.tag");
	const { setStatus } = useKitchenMutations();
	const wide = useMediaQuery(TABLET_UP);
	const now = useNow(30_000);
	const [recalling, setRecalling] = useState<string | null>(null);

	const recall = (ticket: KitchenTicketDto) => {
		setRecalling(ticket.id);
		setStatus.mutate(
			{ orderId: ticket.id, status: "READY" },
			{
				onSuccess: () => toast.success(t("recalled", { number: ticket.number })),
				onError: (e) => toast.error(e.message),
				onSettled: () => setRecalling(null),
			}
		);
	};

	return (
		<Sheet>
			<SheetTrigger asChild>
				<Button variant="outline" size="lg" data-tour="kitchen-recent">
					<History />
					{t("recent")}
					{tickets.length ? (
						<span className="numeric rounded-full bg-muted px-1.5 text-muted-foreground text-xs leading-5">
							{tickets.length}
						</span>
					) : null}
				</Button>
			</SheetTrigger>
			{/* A side panel beside the board from tablet up; a drawer from the bottom on a phone. */}
			<SheetContent
				side={wide ? "right" : "bottom"}
				className={cn(
					"gap-0 p-0",
					wide ? "w-full sm:max-w-sm" : "rounded-t-3xl data-[side=bottom]:max-h-[85svh]"
				)}
			>
				{wide ? null : <span aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />}
				<SheetHeader className="gap-1 px-5 pt-5 pb-4 pr-12 text-left">
					<SheetTitle className="flex items-center gap-2 text-lg">
						<span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
							<History className="size-4" />
						</span>
						{t("recent")}
					</SheetTitle>
					<SheetDescription className="text-pretty">{t("recentHint")}</SheetDescription>
				</SheetHeader>

				{tickets.length === 0 ? (
					<div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 pt-6 pb-12 text-center">
						<span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
							<ChefHat className="size-7" />
						</span>
						<p className="font-medium">{t("recentEmptyTitle")}</p>
						<p className="max-w-60 text-muted-foreground text-sm">{t("recentEmpty")}</p>
					</div>
				) : (
					<ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
						{tickets.map((ticket) => {
							const minutes = Math.max(0, Math.floor((now.getTime() - new Date(ticket.updatedAt).getTime()) / 60_000));
							return (
								<li key={ticket.id} className="surface rounded-2xl p-3.5">
									<div className="flex items-center gap-2">
										<span className="numeric font-bold">#{ticket.number}</span>
										{ticket.serviceType ? (
											<span className="rounded-full bg-muted px-2 py-0.5 font-medium text-[11px] text-muted-foreground">
												{tTag(ticket.serviceType)}
											</span>
										) : null}
										{ticket.label ? <span className="font-semibold text-sm">{ticket.label}</span> : null}
										<span className="ml-auto flex items-center gap-1 text-success text-xs" suppressHydrationWarning>
											<Check className="size-3.5" />
											{minutes < 1 ? t("servedJustNow") : t("servedAgo", { count: minutes })}
										</span>
									</div>
									{/* Items and the recall side by side: a full-width button per ticket was heavier than the ticket. */}
									<div className="mt-2 flex items-end gap-3">
										<ul className="min-w-0 flex-1 space-y-0.5 text-sm">
											{ticket.lines.map((l) => (
												<li key={l.id} className="flex gap-2">
													<span className="numeric w-6 shrink-0 text-muted-foreground">{l.quantity}×</span>
													<span className="min-w-0 flex-1 truncate">{l.name}</span>
												</li>
											))}
										</ul>
										<Button
											variant="outline"
											size="sm"
											className="h-8 shrink-0 rounded-lg"
											disabled={recalling === ticket.id}
											onClick={() => recall(ticket)}
										>
											{recalling === ticket.id ? <Loader2 className="animate-spin" /> : <RotateCcw />}
											{t("recall")}
										</Button>
									</div>
								</li>
							);
						})}
					</ul>
				)}
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
	const sound = useSyncExternalStore(subscribeSound, readSound, () => "off" as SoundSetting);
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
		if (seen.current && sound !== "off" && audio.current && [...ids].some((id) => !seen.current?.has(id))) {
			play(audio.current, sound);
		}
		seen.current = new Set([...(seen.current ?? []), ...ids]);
	}, [board.data, sound]);

	const chooseSound = (setting: SoundSetting) => {
		// Browsers only let a page make sound after a tap; choosing is that tap, and a preview.
		if (setting !== "off") {
			audio.current ??= new AudioContext();
			void audio.current.resume();
			play(audio.current, setting);
		}
		writeSound(setting);
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
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							{/* On or off at a glance; which tone is a detail for the menu. */}
							<Button variant="outline" size="lg" data-tour="kitchen-sound" className="gap-2">
								{sound === "off" ? <BellOff className="text-muted-foreground" /> : <Bell />}
								{sound === "off" ? t("soundOff") : t("soundOn")}
								<ChevronDown className="size-4 text-muted-foreground" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-72 p-1.5">
							<div className="px-2.5 pt-1.5 pb-2">
								<p className="font-medium text-sm">{t("sound")}</p>
								<p className="text-muted-foreground text-xs">{t("soundHint")}</p>
							</div>
							<DropdownMenuSeparator />
							<DropdownMenuRadioGroup value={sound} onValueChange={(v) => chooseSound(v as SoundSetting)}>
								{TONES.map((tone) => (
									// Keeps the menu open, so tones can be tried one after another.
									<DropdownMenuRadioItem
										key={tone}
										value={tone}
										onSelect={(e) => e.preventDefault()}
										className="gap-3 rounded-lg py-2 pr-9 pl-2"
									>
										<span
											className={cn(
												"flex size-8 items-center justify-center rounded-lg",
												sound === tone ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
											)}
										>
											<Volume2 className="size-4" />
										</span>
										<span className="flex min-w-0 flex-col">
											<span className="font-medium">{t(`tones.${tone}`)}</span>
											<span className="text-muted-foreground text-xs">{t(`toneHints.${tone}`)}</span>
										</span>
									</DropdownMenuRadioItem>
								))}
								<DropdownMenuSeparator />
								<DropdownMenuRadioItem value="off" className="gap-3 rounded-lg py-2 pr-9 pl-2">
									<span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
										<BellOff className="size-4" />
									</span>
									<span className="font-medium">{t("soundOff")}</span>
								</DropdownMenuRadioItem>
							</DropdownMenuRadioGroup>
						</DropdownMenuContent>
					</DropdownMenu>
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
							{board.isPending ? (
								<Skeleton className="ml-auto h-6 w-8 rounded-full" />
							) : (
								<span className="numeric ml-auto rounded-full bg-card px-2.5 py-0.5 text-sm shadow-xs">
									{tickets.length}
								</span>
							)}
						</>
					);
					const body = board.isPending ? (
						<>
							<TicketSkeleton />
							{column === "READY" ? null : <TicketSkeleton lines={2} />}
						</>
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
