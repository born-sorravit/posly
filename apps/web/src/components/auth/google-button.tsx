"use client";

import { env } from "@/lib/env";
import { Button } from "@posly/ui/components/button";
import { cn } from "@/lib/utils";
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

function GoogleIcon() {
	return (
		<svg viewBox="0 0 24 24" className="size-4" aria-hidden>
			<path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.2-4.7 3.2-8Z" />
			<path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23Z" />
			<path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.7-2.8Z" />
			<path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4Z" />
		</svg>
	);
}

/**
 * "Continue with Google" via Google Identity Services. Only Google's own button (an iframe)
 * may open its popup, and it cannot be styled, so it is rendered invisibly on top of our
 * `Button`: people see the form's button and click Google's. The ID token it returns is
 * handed to `onCredential`; the API verifies it.
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
			theme: "outline",
			size: "large",
			text: mode === "register" ? "signup_with" : "continue_with",
			shape: "rectangular",
			logo_alignment: "center",
			width: Math.min(MAX_WIDTH, Math.round(parent.offsetWidth)),
			locale: "th",
		});
		setReady(true);
	}, [mode]);

	// Script already loaded by an earlier page (client-side navigation).
	useEffect(() => {
		if (window.google) render();
	}, [render]);

	const face = (
		<Button
			type="button"
			variant="outline"
			size="lg"
			tabIndex={-1}
			disabled={!env.googleClientId || !ready}
			className={cn(
				"h-11 w-full rounded-xl",
				// Waiting for Google's script is not "disabled" to the eye.
				env.googleClientId && "disabled:opacity-100",
				// Google's invisible iframe takes the pointer; hovering it still hovers this group.
				"group-hover:bg-muted group-hover:text-foreground"
			)}
		>
			<GoogleIcon />
			{label}
		</Button>
	);

	if (!env.googleClientId) return face;

	return (
		<div className="group relative h-11 w-full">
			<Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={render} />
			{face}
			<div
				ref={container}
				className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-xl opacity-0 [color-scheme:normal]"
			/>
		</div>
	);
}
