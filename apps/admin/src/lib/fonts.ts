import { Anuphan, Geist, Geist_Mono } from "next/font/google";

/**
 * Typography is loaded in one place so the stack is auditable and swappable.
 *
 * Latin runs on Geist (what the shadcn preset is designed around); Thai runs on Anuphan,
 * a modern Thai sans whose geometric, open forms sit comfortably next to it. Geist ships
 * no Thai glyphs at all, so the browser falls back **per glyph**, not per string — which
 * is why Geist is listed first in `--font-sans` even though most of the content is Thai.
 *
 * Both Anuphan and Geist are variable fonts: one file covers every weight.
 */
export const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
	display: "swap",
});

export const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
	display: "swap",
});

export const anuphan = Anuphan({
	variable: "--font-anuphan",
	subsets: ["thai", "latin"],
	display: "swap",
});

/** Applied to `<html>`; `--font-sans` in globals.css composes these into the real stack. */
export const fontVariables = [geistSans.variable, geistMono.variable, anuphan.variable].join(" ");
