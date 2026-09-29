"use client";

import { useSyncExternalStore } from "react";

/**
 * Subscribes to a media query. Server render assumes `false`, so anything that differs by
 * breakpoint should be CSS-first and use this only for behaviour (sheet vs dialog).
 */
export function useMediaQuery(query: string): boolean {
	return useSyncExternalStore(
		(onChange) => {
			const list = window.matchMedia(query);
			list.addEventListener("change", onChange);
			return () => list.removeEventListener("change", onChange);
		},
		() => window.matchMedia(query).matches,
		() => false
	);
}

export const TABLET_UP = "(min-width: 768px)";
export const DESKTOP_UP = "(min-width: 1280px)";
