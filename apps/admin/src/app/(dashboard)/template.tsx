"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Remounts on every navigation (a template, not a layout), so each page arrives with the
 * same short rise-and-fade. Short on purpose: it marks the change, it does not delay it.
 */
export default function DashboardTemplate({ children }: { children: ReactNode }) {
	return (
		<motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
			{children}
		</motion.div>
	);
}
