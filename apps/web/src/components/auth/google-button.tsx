"use client";

import { env } from "@/lib/env";
import { Button } from "@posly/ui/components/button";
import { useTheme } from "next-themes";
import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

interface GoogleCredentialResponse {
	credential: string;
}

interface GoogleIdentityServices {
	accounts: {
		id: {
			initialize: (config: {
				client_id: string;
				callback: (response: GoogleCredentialResponse) => void;
				ux_mode?: "popup" | "redirect";
				context?: "signin" | "signup" | "use";
				itp_support?: boolean;
			}) => void;
			renderButton: (
				parent: HTMLElement,
				options: {
					type?: "standard" | "icon";
					theme?: "outline" | "filled_blue" | "filled_black";
					size?: "large" | "medium" | "small";
					text?: "signin_with" | "signup_with" | "continue_with";
					shape?: "rectangular" | "pill";
					logo_alignment?: "left" | "center";
					width?: number;
					locale?: string;
				}
			) => void;
		};
	};
}

declare global {
	interface Window {
		google?: GoogleIdentityServices;
	}
}

/** Google caps its rendered button at 400px. */
const MAX_WIDTH = 400;

/**
 * Google's own "Sign in with Google" button (Google Identity Services). Google renders it in
 * an iframe, which is why it is not our `Button`: only that button may open Google's popup.
 * The ID token it returns is handed to `onCredential`; the API verifies it.
 *
 * Without NEXT_PUBLIC_GOOGLE_CLIENT_ID it stays a disabled placeholder.
 */
export function GoogleButton({
	mode,
	label,
	onCredential,
}: {
	mode: "login" | "register";
	label: string;
	onCredential: (idToken: string) => void;
}) {
	const container = useRef<HTMLDivElement>(null);
	const [ready, setReady] = useState(false);
	const { resolvedTheme } = useTheme();
	// The latest handler, without re-initialising Google every render.
	const handler = useRef(onCredential);
	useEffect(() => {
		handler.current = onCredential;
	}, [onCredential]);

	const render = useCallback(() => {
		const google = window.google;
		const parent = container.current;
		if (!google || !parent || !env.googleClientId) return;

		google.accounts.id.initialize({
			client_id: env.googleClientId,
			callback: (response) => handler.current(response.credential),
			ux_mode: "popup",
			context: mode === "register" ? "signup" : "signin",
			itp_support: true,
		});
		parent.replaceChildren();
		google.accounts.id.renderButton(parent, {
			type: "standard",
			theme: resolvedTheme === "dark" ? "filled_black" : "outline",
			size: "large",
			text: mode === "register" ? "signup_with" : "continue_with",
			shape: "pill",
			logo_alignment: "center",
			width: Math.min(MAX_WIDTH, Math.round(parent.offsetWidth)),
			locale: "th",
		});
		setReady(true);
	}, [mode, resolvedTheme]);

	// Script already loaded by an earlier page (client-side navigation), or the theme changed.
	useEffect(() => {
		if (window.google) render();
	}, [render]);

	if (!env.googleClientId) {
		return (
			<Button type="button" variant="outline" size="lg" className="h-11 w-full rounded-xl" disabled>
				{label}
			</Button>
		);
	}

	return (
		<>
			<Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={render} />
			<div className="relative h-11 w-full">
				{/* Holds the space while Google's iframe loads, so the form does not jump. */}
				{ready ? null : <div className="absolute inset-0 animate-pulse rounded-full bg-muted" />}
				<div ref={container} className="flex h-11 w-full items-center justify-center [color-scheme:normal]" />
			</div>
		</>
	);
}
