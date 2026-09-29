import type { MetadataRoute } from "next";

/**
 * Installable (plan §37): "Add to Home Screen" on a tablet opens the POS fullscreen, with no
 * browser chrome eating the counter's screen. Offline orders come later (§38); the service
 * worker only shows an offline page.
 */
export default function manifest(): MetadataRoute.Manifest {
	return {
		id: "/pos",
		name: "Posly — POS สำหรับร้านเล็ก",
		short_name: "Posly",
		description: "ระบบ POS สำหรับร้านเล็ก ขายง่าย ดูยอดได้ทุกที่",
		start_url: "/pos",
		scope: "/",
		display: "fullscreen",
		display_override: ["fullscreen", "standalone"],
		orientation: "any",
		background_color: "#f8f9fc",
		theme_color: "#635bff",
		lang: "th",
		categories: ["business", "productivity"],
		icons: [
			{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
			{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
			{ src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
			{ src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
		],
		shortcuts: [
			{ name: "ขายสินค้า", short_name: "POS", url: "/pos", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
			{ name: "รายการขาย", url: "/orders", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
			{ name: "รายงาน", url: "/reports", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
		],
	};
}
