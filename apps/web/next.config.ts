import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

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
			// Product photos and store logos live in Supabase Storage's public bucket.
			{
				protocol: "https",
				hostname: "*.supabase.co",
				pathname: "/storage/v1/object/public/**",
			},
		],
	},
};

export default withNextIntl(nextConfig);
