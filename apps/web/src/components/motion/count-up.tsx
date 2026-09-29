"use client";

import type { Locale } from "@/i18n/routing";
import { animate, useInView } from "motion/react";
import { useEffect, useRef } from "react";

/** Fast at first, settling at the end — a linear count reads as a loading spinner. */
const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Named explicitly, the same way `formatSalaryRange` does it, rather than left to
 * `toLocaleString()`. This component renders on the server and again in the browser, and a
 * bare `toLocaleString()` would ask two different machines what grouping to use — agreement
 * for 42, and a hydration mismatch the first time a figure passes a thousand.
 */
const numberFormat = (locale: Locale) =>
	new Intl.NumberFormat(locale === "th" ? "th-TH" : "en-US");

/**
 * A figure that counts up the first time it is scrolled into view.
 *
 * The rendered text is the final value, not the starting one. The server has to emit the real
 * number: it is what a reader without JavaScript sees, what a crawler indexes, and what
 * hydration compares against. The count is written straight to the node's `textContent` from
 * the animation frame instead of through state — three figures re-rendering sixty times a
 * second is a lot of React for something the DOM can do by itself.
 *
 * The jump back to the start is covered by the hero's own entrance fade, which is still
 * running when this begins.
 *
 * Reduced motion is read here rather than during render. `MotionConfig reducedMotion="user"`
 * in `Providers` only strips transforms, and this animates neither transform nor opacity, so
 * it has to answer for itself — inside the effect, where there is a `window` to ask and no
 * server render to disagree with.
 */
export function CountUp({
	value,
	locale,
	duration = 1.1,
	className,
}: {
	value: number;
	locale: Locale;
	duration?: number;
	className?: string;
}) {
	const ref = useRef<HTMLSpanElement>(null);
	const inView = useInView(ref, { once: true, margin: "-40px" });

	useEffect(() => {
		const node = ref.current;
		if (!node || !inView) return;

		const formatter = numberFormat(locale);
		const format = (n: number) => formatter.format(Math.round(n));

		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			node.textContent = format(value);
			return;
		}

		const controls = animate(0, value, {
			duration,
			ease: EASE,
			onUpdate: (latest) => {
				node.textContent = format(latest);
			},
		});

		return () => controls.stop();
	}, [inView, value, duration, locale]);

	return (
		<span ref={ref} className={className}>
			{numberFormat(locale).format(value)}
		</span>
	);
}
