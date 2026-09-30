"use client";

import { Label } from "@posly/ui/components/label";
import { Switch } from "@posly/ui/components/switch";
import { useSyncExternalStore } from "react";

const STORAGE_KEY = "posly-admin:include-demo";
const listeners = new Set<() => void>();

const read = (): boolean => {
	try {
		return localStorage.getItem(STORAGE_KEY) === "true";
	} catch {
		return false;
	}
};

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	// Another tab flipping the switch.
	window.addEventListener("storage", listener);
	return () => {
		listeners.delete(listener);
		window.removeEventListener("storage", listener);
	};
};

const write = (value: boolean) => {
	try {
		localStorage.setItem(STORAGE_KEY, String(value));
	} catch {
		// Storage blocked: the switch simply does not stick.
	}
	for (const listener of listeners) listener();
};

/**
 * Whether figures include the shared demo shops. Off by default — visitors ring up orders
 * there all day, which would drown the real numbers. Remembered per browser; the server
 * render always says "off", so the first frame matches.
 */
export function useDemoFilter() {
	const includeDemo = useSyncExternalStore(subscribe, read, () => false);
	return { includeDemo, setIncludeDemo: write };
}

export function DemoToggle() {
	const { includeDemo, setIncludeDemo } = useDemoFilter();
	return (
		<div className="flex items-center gap-2">
			<Switch id="include-demo" checked={includeDemo} onCheckedChange={setIncludeDemo} />
			<Label htmlFor="include-demo" className="text-muted-foreground text-sm">
				รวมร้าน demo
			</Label>
		</div>
	);
}
