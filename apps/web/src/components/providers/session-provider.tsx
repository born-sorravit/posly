"use client";

import type { AuthUser } from "@posly/types/api";
import { type ReactNode, createContext, useCallback, useContext, useState } from "react";

interface SessionValue {
	user: AuthUser | null;
	isLoading: boolean;
	refresh: () => Promise<void>;
	reload: () => Promise<void>;
	signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

/**
 * The signed-in user, for client components.
 *
 * Seeded from the server render, so there is no signed-out flash and no fetch on mount:
 * middleware has already refreshed a stale token before the page rendered. `refresh()`
 * remains for after a sign-in, when the session changes without a navigation.
 */
export function SessionProvider({
	children,
	initialUser,
}: {
	children: ReactNode;
	initialUser: AuthUser | null;
}) {
	const [user, setUser] = useState<AuthUser | null>(initialUser);
	const [isLoading, setIsLoading] = useState(false);

	const refresh = useCallback(async () => {
		try {
			const response = await fetch("/api/auth/refresh", { method: "POST" });
			const payload = (await response.json().catch(() => null)) as { user?: AuthUser } | null;
			setUser(response.ok ? (payload?.user ?? null) : null);
		} catch {
			setUser(null);
		} finally {
			setIsLoading(false);
		}
	}, []);

	/**
	 * Re-reads the account without touching the session.
	 *
	 * `refresh()` rotates the refresh token, which is the wrong tool for "the name changed" —
	 * this just asks who is signed in.
	 */
	const reload = useCallback(async () => {
		try {
			const response = await fetch("/api/auth/session");
			const payload = (await response.json().catch(() => null)) as { user?: AuthUser } | null;
			if (response.ok) setUser(payload?.user ?? null);
		} catch {
			// Leave the last known user in place: a failed read is not a sign-out.
		}
	}, []);

	const signOut = useCallback(async () => {
		await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
		setUser(null);
	}, []);

	return (
		<SessionContext.Provider value={{ user, isLoading, refresh, reload, signOut }}>
			{children}
		</SessionContext.Provider>
	);
}

export function useSession(): SessionValue {
	const value = useContext(SessionContext);
	if (!value) {
		throw new Error("useSession must be used inside SessionProvider");
	}
	return value;
}
