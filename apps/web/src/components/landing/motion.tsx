"use client";

import { cn } from "@/lib/utils";
import {
	animate,
	motion,
	useInView,
	useMotionValue,
	useReducedMotion,
	useScroll,
	useTransform,
	type Variants,
} from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";

/*
 * The landing page's motion, as small client islands so the page itself stays a server
 * component. One easing and a short set of durations throughout; everything plays once, and
 * `MotionConfig reducedMotion="user"` (in Providers) turns movement into a plain fade for
 * anyone who asked their OS for less.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

/** Fades and rises into place the first time it scrolls into view. */
export function Reveal({
	children,
	className,
	delay = 0,
	y = 24,
	onLoad = false,
}: {
	children: ReactNode;
	className?: string;
	delay?: number;
	y?: number;
	/** Play on page load rather than on scroll — for the hero, which is already in view. */
	onLoad?: boolean;
}) {
	const hidden = { opacity: 0, y };
	const shown = { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE, delay } };
	return onLoad ? (
		<motion.div className={className} initial={hidden} animate={shown}>
			{children}
		</motion.div>
	) : (
		<motion.div className={className} initial={hidden} whileInView={shown} viewport={{ once: true, margin: "-80px" }}>
			{children}
		</motion.div>
	);
}

const container: Variants = {
	hidden: {},
	shown: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const item: Variants = {
	hidden: { opacity: 0, y: 28, scale: 0.98 },
	shown: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: EASE } },
};

/** A grid whose children arrive one after another. Children must be `StaggerItem`s. */
export function Stagger({ children, className, as = "div" }: { children: ReactNode; className?: string; as?: "div" | "ol" | "ul" }) {
	const Tag = as === "ol" ? motion.ol : as === "ul" ? motion.ul : motion.div;
	return (
		<Tag className={className} variants={container} initial="hidden" whileInView="shown" viewport={{ once: true, margin: "-80px" }}>
			{children}
		</Tag>
	);
}

export function StaggerItem({ children, className, as = "div" }: { children: ReactNode; className?: string; as?: "div" | "li" }) {
	const Tag = as === "li" ? motion.li : motion.div;
	return (
		<Tag className={className} variants={item}>
			{children}
		</Tag>
	);
}

/**
 * The hero picture: arrives tilted back like a screen on a counter, and straightens up as
 * the page scrolls toward it.
 */
export function TiltIn({ children, className }: { children: ReactNode; className?: string }) {
	const ref = useRef<HTMLDivElement>(null);
	const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 0.35"] });
	const rotateX = useTransform(scrollYProgress, [0, 1], [18, 0]);
	const scale = useTransform(scrollYProgress, [0, 1], [0.92, 1]);
	return (
		<div ref={ref} className={cn("[perspective:1600px]", className)}>
			<motion.div
				style={{ rotateX, scale, transformOrigin: "50% 0%" }}
				initial={{ opacity: 0, y: 60 }}
				animate={{ opacity: 1, y: 0, transition: { duration: 1, ease: EASE, delay: 0.35 } }}
			>
				{children}
			</motion.div>
		</div>
	);
}

/** Pops in after the hero picture, then drifts gently up and down. */
export function Float({
	children,
	className,
	delay = 0,
	distance = 10,
	duration = 6,
}: {
	children: ReactNode;
	className?: string;
	delay?: number;
	distance?: number;
	duration?: number;
}) {
	const reduce = useReducedMotion();
	return (
		<motion.div
			className={className}
			initial={{ opacity: 0, scale: 0.9, y: 16 }}
			animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.7, ease: EASE, delay } }}
		>
			<motion.div
				animate={reduce ? undefined : { y: [0, -distance, 0] }}
				transition={{ duration, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut", delay: delay + 0.7 }}
			>
				{children}
			</motion.div>
		</motion.div>
	);
}

/** Counts up to `value` when it first comes into view. */
export function CountUp({
	value,
	prefix = "",
	suffix = "",
	decimals = 0,
	className,
}: {
	value: number;
	prefix?: string;
	suffix?: string;
	decimals?: number;
	className?: string;
}) {
	const ref = useRef<HTMLSpanElement>(null);
	const inView = useInView(ref, { once: true });
	const count = useMotionValue(0);
	const format = (n: number) =>
		`${prefix}${n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
	const [text, setText] = useState(() => format(value));

	useEffect(() => {
		if (!inView) return;
		const controls = animate(count, value, {
			duration: 1.6,
			ease: EASE,
			onUpdate: (n) => setText(format(n)),
		});
		return () => controls.stop();
		// `format` is rebuilt every render from the same props.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [inView, value, count]);

	// Server HTML shows the final number; the count only runs once it is on screen.
	return (
		<span ref={ref} className={className}>
			{text}
		</span>
	);
}

/** Bars that grow from the baseline, one after another. */
export function GrowBars({ heights, highlight, className }: { heights: number[]; highlight?: number; className?: string }) {
	return (
		<motion.div
			className={cn("flex items-end gap-1", className)}
			initial="hidden"
			whileInView="shown"
			viewport={{ once: true }}
			variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.05, delayChildren: 0.9 } } }}
		>
			{heights.map((h, i) => (
				<motion.span
					// biome-ignore lint/suspicious/noArrayIndexKey: a fixed decorative series
					key={i}
					className={cn("flex-1 origin-bottom rounded-t-sm", i === highlight ? "bg-primary" : "bg-primary/25")}
					style={{ height: `${h}%` }}
					variants={{
						hidden: { scaleY: 0 },
						shown: { scaleY: 1, transition: { duration: 0.5, ease: EASE } },
					}}
				/>
			))}
		</motion.div>
	);
}

/** An SVG line that draws itself, with its area fading in underneath. */
export function DrawnChart({ line, area }: { line: string; area: string }) {
	return (
		<motion.svg
			viewBox="0 0 300 100"
			className="h-32 w-full"
			preserveAspectRatio="none"
			aria-hidden
			initial="hidden"
			whileInView="shown"
			viewport={{ once: true, margin: "-60px" }}
		>
			<defs>
				<linearGradient id="landing-area" x1="0" x2="0" y1="0" y2="1">
					<stop offset="0" stopColor="var(--primary)" stopOpacity="0.28" />
					<stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
				</linearGradient>
			</defs>
			<motion.path
				d={area}
				fill="url(#landing-area)"
				variants={{ hidden: { opacity: 0 }, shown: { opacity: 1, transition: { duration: 0.8, delay: 0.9 } } }}
			/>
			<motion.path
				d={line}
				fill="none"
				stroke="var(--primary)"
				strokeWidth="2"
				vectorEffect="non-scaling-stroke"
				variants={{ hidden: { pathLength: 0 }, shown: { pathLength: 1, transition: { duration: 1.4, ease: EASE } } }}
			/>
		</motion.svg>
	);
}
