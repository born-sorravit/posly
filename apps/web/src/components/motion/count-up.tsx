"use client";

// Kept in step with apps/admin/src/components/motion/count-up.tsx: the same easing, the same
// server-renders-the-real-number rule, any formatter, and it follows refetches.

import { animate, useInView } from "motion/react";
import { useEffect, useLayoutEffect, useRef } from "react";

/** Fast at first, settling at the end — a linear count reads as a loading spinner. */
const EASE = [0.16, 1, 0.3, 1] as const;

// useLayoutEffect warns on the server; there is nothing to lay out there anyway.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A figure that counts up from zero the first time it scrolls into view, then eases from the
 * old figure to the new one whenever a refetch changes it — a sale on another till, or the
 * period switched — so a number that moved says so instead of swapping unnoticed.
 *
 * `format` receives a whole number in the value's own unit (satang for money), so
 * `formatBaht` and `formatNumber` plug straight in. Pass a stable function (those two are):
 * a new inline arrow on every render restarts the count. `step` rounds the figures in
 * between — 100 for money, so the count runs in whole baht and the ".55" does not flicker
 * on and off; the last frame is always the exact value.
 *
 * The rendered text is always the final value, so the server and hydration agree and a
 * reader without JavaScript sees the real figure. Before the first paint the node is reset
 * to zero, so a card below the fold does not show its number, drop to 0 and climb back when
 * it is scrolled to. Updates are written to `textContent` from the animation frame rather
 * than through state: four cards re-rendering sixty times a second is a lot of React for
 * something the DOM does by itself.
 *
 * Reduced motion is answered here: `MotionConfig reducedMotion="user"` only strips
 * transforms, and this animates neither transform nor opacity.
 */
export function CountUp({
	value,
	format,
	step = 1,
	duration = 1.1,
	className,
}: {
	value: number;
	format: (n: number) => string;
	step?: number;
	duration?: number;
	className?: string;
}) {
	const ref = useRef<HTMLSpanElement>(null);
	const inView = useInView(ref, { once: true, margin: "-40px" });
	/** What the node shows now; null until the first count has run. */
	const shown = useRef<number | null>(null);
	// Before paint: React has just written the final figure, so put back what was showing —
	// zero before the first count, the old figure on an update — and let the count move it.
	// biome-ignore lint/correctness/useExhaustiveDependencies: `value` is the trigger, not an input
	useIsoLayoutEffect(() => {
		if (ref.current && !reducedMotion()) ref.current.textContent = format(Math.round(shown.current ?? 0));
	}, [value, format]);

	useEffect(() => {
		const node = ref.current;
		if (!node || !inView) return;
		const write = (n: number) => {
			shown.current = n;
			node.textContent = format(n === value ? value : Math.round(n / step) * step);
		};

		if (reducedMotion()) {
			write(value);
			return;
		}
		const first = shown.current === null;
		const controls = animate(shown.current ?? 0, value, {
			duration: first ? duration : Math.min(duration, 0.6),
			ease: EASE,
			onUpdate: write,
		});
		return () => controls.stop();
	}, [inView, value, duration, format, step]);

	return (
		<span ref={ref} className={className}>
			{format(value)}
		</span>
	);
}
