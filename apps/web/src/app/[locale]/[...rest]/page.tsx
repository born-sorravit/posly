import { notFound } from "next/navigation";

/**
 * Every URL the proxy rewrote under a locale but no route matched. Without this, Next falls
 * back to its own unstyled 404 outside `[locale]/layout.tsx`; throwing here renders
 * `[locale]/not-found.tsx` inside the real shell, with fonts, theme and messages.
 */
export default function CatchAll() {
	notFound();
}
