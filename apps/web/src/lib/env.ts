/**
 * Public runtime configuration.
 *
 * Next inlines `NEXT_PUBLIC_*` at build time, so these must be read as full property
 * accesses — `process.env[key]` would not be replaced and would be undefined in the browser.
 */
export const env = {
	apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api/v1",
	siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
	googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
} as const;
