"use client";

import { cn } from "@/lib/utils";
import { type Variants, motion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Entrance motion: `Reveal` for a single block, `Stagger`/`StaggerItem` for a list that
 * should arrive in sequence, `HoverLift` for a card that rises under the pointer.
 *
 * None of these branch on `useReducedMotion()`. That hook reads `matchMedia`, which does not
 * exist while rendering on the server, so returning a different element for a reduced-motion
 * reader renders one tree on the server and another on the client — a hydration mismatch.
 * Honouring the preference is `MotionConfig reducedMotion="user"` in `Providers`, which keeps
 * the tree identical and drops the transforms instead. Opacity is left alone deliberately:
 * the preference is about movement, not about things fading in.
 */

/** Decelerating, no overshoot. Interface motion should feel settled, not springy. */
const EASE = [0.22, 1, 0.36, 1] as const;
const DURATION = 0.45;

/** Far enough to read as movement, near enough that nothing appears to jump. */
const DISTANCE = 14;

export function Reveal({
	children,
	className,
	delay = 0,
	y = DISTANCE,
}: {
	children: ReactNode;
	className?: string;
	delay?: number;
	y?: number;
}) {
	return (
		<motion.div
			className={className}
			initial={{ opacity: 0, y }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: DURATION, delay, ease: EASE }}
		>
			{children}
		</motion.div>
	);
}

const container = (gap: number, delay: number): Variants => ({
	hidden: {},
	shown: { transition: { staggerChildren: gap, delayChildren: delay } },
});

const item: Variants = {
	hidden: { opacity: 0, y: DISTANCE },
	shown: { opacity: 1, y: 0, transition: { duration: DURATION, ease: EASE } },
};

/**
 * Animates its children in sequence.
 *
 * `trigger` is not a style choice, it is about whether the list can change.
 *
 * `"in-view"` waits for the group to scroll into view and, with `once`, stops observing
 * afterwards — right for a fixed list further down a page, wrong for one whose contents
 * change, because a child that mounts after the observer has stopped is never told to leave
 * `hidden` and stays at `opacity: 0` forever. Clearing a filter did exactly that.
 *
 * `"mount"` animates immediately and keeps the parent in the `shown` state, so children that
 * arrive later still animate in. Use it for anything driven by a query.
 */
export function Stagger({
	children,
	className,
	gap = 0.06,
	delay = 0,
	trigger = "in-view",
}: {
	children: ReactNode;
	className?: string;
	gap?: number;
	delay?: number;
	trigger?: "in-view" | "mount";
}) {
	const motionProps =
		trigger === "mount"
			? { animate: "shown" as const }
			: {
					whileInView: "shown" as const,
					// `once` matters: a list that replays every time it re-enters the viewport
					// turns scrolling into a slideshow.
					viewport: { once: true, margin: "-60px" },
				};

	return (
		<motion.div
			className={className}
			variants={container(gap, delay)}
			initial="hidden"
			{...motionProps}
		>
			{children}
		</motion.div>
	);
}

export function StaggerItem({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<motion.div className={className} variants={item}>
			{children}
		</motion.div>
	);
}

/**
 * A card that lifts under the pointer.
 *
 * Spring rather than a CSS transition so the return is damped — a card that snaps back on
 * mouse-out feels mechanical, one that settles feels physical.
 */
export function HoverLift({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<motion.div
			className={cn("h-full", className)}
			whileHover={{ y: -4 }}
			transition={{ type: "spring", stiffness: 380, damping: 28 }}
		>
			{children}
		</motion.div>
	);
}
