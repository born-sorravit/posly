"use client";

import type { PointerEvent } from "react";

/**
 * Hands the pointer's position to `.spotlight-border`, which does the drawing.
 *
 * Written straight onto the node's inline style rather than held in state: this fires on every
 * pointer move, and a card that re-renders sixty times a second to move a highlight one pixel
 * is a lot of React for a decoration.
 *
 * The rectangle is measured on every move rather than cached on enter. It looks wasteful and
 * is not: `HoverLift` slides the card up by four pixels the moment the pointer arrives, so a
 * rectangle measured once is wrong for exactly as long as the effect is visible.
 */
export const trackSpotlight = (event: PointerEvent<HTMLElement>) => {
	const host = event.currentTarget;
	const rect = host.getBoundingClientRect();

	host.style.setProperty("--mx", `${event.clientX - rect.left}px`);
	host.style.setProperty("--my", `${event.clientY - rect.top}px`);
};
