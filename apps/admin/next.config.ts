import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	reactStrictMode: true,
	// Workspace packages ship TypeScript source; Next compiles them with the app.
	transpilePackages: ["@posly/ui", "@posly/types", "@posly/utils"],
};

export default nextConfig;
