import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * `.mts` because this file is ESM — Vite loads a plain `.ts` config as CommonJS.
 *
 * No jsdom, deliberately.
 *
 * What is tested here is pure logic that lives on both sides of the SSR boundary; a DOM
 * environment would only slow it down. Component and page behaviour is verified by driving
 * the real app in a browser, which covers more than a shallow render would.
 */
export default defineConfig({
	test: {
		environment: "node",
		include: ["src/**/*.spec.ts"],
	},
	resolve: {
		alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
	},
});
