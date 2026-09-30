"use client";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { type ReactNode, useId } from "react";

// Copied from apps/web/src/components/common/controls.tsx — keep the two in step.
/**
 * A single-choice pill row: date ranges, order filters, category chips. The selected pill
 * slides rather than jumps, and nothing else about it animates.
 */
export function Segmented<T extends string>({
	value,
	onChange,
	options,
	size = "md",
	className,
	variant = "track",
}: {
	value: T;
	onChange: (value: T) => void;
	options: { value: T; label: ReactNode }[];
	size?: "sm" | "md" | "lg";
	className?: string;
	/** `track` sits the pills on a muted rail; `chips` spaces them out as separate chips. */
	variant?: "track" | "chips";
}) {
	const id = useId();
	return (
		<div
			role="radiogroup"
			className={cn(
				"no-scrollbar flex max-w-full items-center overflow-x-auto",
				// Chips get a little breathing room inside the scroller: overflow clips box-shadows,
				// which is what cut the top edge off every chip.
				variant === "track" ? "gap-0.5 rounded-lg bg-muted/70 p-0.5" : "-mx-1 gap-1.5 px-1 py-1",
				className
			)}
		>
			{options.map((option) => {
				const selected = option.value === value;
				return (
					<button
						key={option.value}
						type="button"
						role="radio"
						aria-checked={selected}
						onClick={() => onChange(option.value)}
						className={cn(
							"touch-target relative shrink-0 whitespace-nowrap font-medium transition-colors",
							size === "sm" && "h-7 rounded-lg px-2.5 text-xs",
							size === "md" && "h-8 rounded-md px-3 text-sm",
							size === "lg" && "h-11 rounded-xl px-4 text-sm",
							variant === "chips" && !selected && "surface text-muted-foreground hover:text-foreground",
							variant === "track" && !selected && "text-muted-foreground hover:text-foreground",
							selected && (variant === "chips" ? "text-primary-foreground" : "text-foreground")
						)}
					>
						{selected ? (
							<motion.span
								layoutId={`seg-${id}`}
								className={cn(
									"absolute inset-0",
									size === "lg" ? "rounded-xl" : "rounded-md",
									// No outer glow: the chip row scrolls, and a scroller clips anything drawn outside
									// the chip — a glow comes out as a hard rectangle. A lit top edge stays inside.
									variant === "chips"
										? "brand-gradient shadow-[inset_0_1px_0_0_oklch(1_0_0/0.25)]"
										: "bg-card shadow-sm dark:bg-white/10"
								)}
								transition={{ type: "spring", stiffness: 600, damping: 40 }}
							/>
						) : null}
						<span className="relative">{option.label}</span>
					</button>
				);
			})}
		</div>
	);
}
