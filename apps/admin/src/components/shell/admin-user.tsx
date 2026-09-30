"use client";

import type { AuthUser } from "@posly/types/api";
import { createContext, type ReactNode, useContext } from "react";

const AdminUserContext = createContext<AuthUser | null>(null);

/** The signed-in admin, for components that need to know "is this mine?" (notes, self). */
export function AdminUserProvider({ user, children }: { user: AuthUser; children: ReactNode }) {
	return <AdminUserContext.Provider value={user}>{children}</AdminUserContext.Provider>;
}

export function useAdminUser(): AuthUser | null {
	return useContext(AdminUserContext);
}
