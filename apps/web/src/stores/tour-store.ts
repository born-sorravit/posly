"use client";

import { create } from "zustand";

/** "app" is the first-run walk through the menu; the others explain one page each. */
export type PageTourId =
	| "pos"
	| "products"
	| "inventory"
	| "orders"
	| "reports"
	| "kitchen"
	| "modifiers"
	| "customers"
	| "expenses";
export type TourId = "app" | PageTourId;

/**
 * The tour's open/closed state, so anything can start it — the user menu's
 * "แนะนำการใช้งาน", the header's "?" on a page, the command menu, or a first visit.
 */
interface TourState {
	open: boolean;
	tour: TourId;
	/** The step on screen; every start begins again at the first. */
	index: number;
	start: (tour?: TourId) => void;
	stop: () => void;
	go: (index: number) => void;
}

export const useTourStore = create<TourState>((set) => ({
	open: false,
	tour: "app",
	index: 0,
	start: (tour = "app") => set({ open: true, tour, index: 0 }),
	stop: () => set({ open: false }),
	go: (index) => set({ index }),
}));

/** The page tour for a path, if that page has one. */
export const pageTourFor = (pathname: string): PageTourId | null => {
	const page = pathname.replace(/\/+$/, "") || "/";
	const tours: Record<string, PageTourId> = {
		"/pos": "pos",
		"/products": "products",
		"/inventory": "inventory",
		"/orders": "orders",
		"/reports": "reports",
		"/kitchen": "kitchen",
		"/modifiers": "modifiers",
		"/customers": "customers",
		"/expenses": "expenses",
	};
	return tours[page] ?? null;
};

/*
 * Whether to show a tour on its own. Per browser, per user: it is a convenience, and a
 * missed or repeated tour costs nothing — the replay buttons are always there.
 */
const PENDING = "posly:tour-pending";
const seenKey = (userId: string, tour: TourId) =>
	tour === "app" ? `posly:tour-seen:${userId}` : `posly:tour-seen:${userId}:${tour}`;

const safe = <T,>(read: () => T, fallback: T): T => {
	try {
		return read();
	} catch {
		return fallback;
	}
};

/** Onboarding calls this once the shop exists, so the first visit to the app opens the tour. */
export const markTourPending = () => safe(() => localStorage.setItem(PENDING, "1"), undefined);

/** True once per new shop, and only for someone who has not already been through it. */
export const shouldAutoStartTour = (userId: string) =>
	safe(() => localStorage.getItem(PENDING) === "1" && localStorage.getItem(seenKey(userId, "app")) === null, false);

/**
 * A page's own tour opens by itself on the first visit — but only after the main tour has
 * been seen, so a new owner is never handed two tours at once.
 */
export const shouldAutoStartPageTour = (userId: string, tour: PageTourId) =>
	safe(
		() => localStorage.getItem(seenKey(userId, "app")) !== null && localStorage.getItem(seenKey(userId, tour)) === null,
		false
	);

export const markTourSeen = (userId: string, tour: TourId = "app") =>
	safe(() => {
		if (tour === "app") localStorage.removeItem(PENDING);
		localStorage.setItem(seenKey(userId, tour), new Date().toISOString());
	}, undefined);
