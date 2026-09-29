import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Read at build time, the same variable src/lib/env.ts inlines.
const apiUrl = new URL(
	process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api/v1"
);

const nextConfig: NextConfig = {
	// Workspace packages ship TypeScript source; Next compiles them with the app.
	transpilePackages: ["@posly/ui", "@posly/types", "@posly/utils"],
	reactStrictMode: true,
	// The service worker must never be served stale, or a fix to it could take days to land.
	async headers() {
		return [
			{
				source: "/sw.js",
				headers: [
					{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
					{ key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
				],
			},
		];
	},
	images: {
		remotePatterns: [
			// Product photos and store logos: the API's /media route, which redirects to a
			// presigned URL on the private Railway bucket (the optimizer follows it).
			{
				protocol: apiUrl.protocol === "http:" ? "http" : "https",
				hostname: apiUrl.hostname,
				port: apiUrl.port,
				pathname: `${apiUrl.pathname.replace(/\/+$/, "")}/media/**`,
			},
		],
		// The optimizer refuses private addresses, and in development the API is localhost.
		dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
	},
};

export default withNextIntl(nextConfig);
