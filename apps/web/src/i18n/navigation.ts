import { routing } from "@/i18n/routing";
import { createNavigation } from "next-intl/navigation";

/**
 * Locale-aware replacements for next/link and the router hooks. Import these instead of
 * the next/navigation originals so the active locale prefix is never lost on navigation.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
