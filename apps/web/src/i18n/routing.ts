import { defineRouting } from "next-intl/routing";

/**
 * Thai only for now, unprefixed (`/pos`). The routing is next-intl's from day one so adding
 * English is a messages file and one entry here, not a restructure of `app/`.
 */
export const locales = ["th"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "th";

export const routing = defineRouting({
	locales,
	defaultLocale,
	localePrefix: "as-needed",
	localeDetection: false,
});
