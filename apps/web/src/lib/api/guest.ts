import messages from "@/../messages/th.json";
import { BackendError, friendlyMessage } from "@/lib/api/backend";
import type { ProductArt } from "@posly/types/domain";
import type { Satang } from "@posly/utils/money";
import type { TableRequestDto } from "@/lib/api/posly";
import { env } from "@/lib/env";

/**
 * What guests reach from the QR on a table. No session: these go straight to the API's public
 * endpoints (like the landing page's prices), never through the signed-in proxy.
 */

export interface GuestMenuDto {
	shopName: string;
	logoUrl: string | null;
	tableName: string;
	/** The shop's plan takes orders from the QR at all; printed QR cards outlive a downgrade. */
	qrOrdering: boolean;
	/** A guest may send a round now. */
	open: boolean;
	categories: { id: string; name: string; icon: string }[];
	products: {
		id: string;
		categoryId: string | null;
		name: string;
		price: Satang;
		art: ProductArt;
		imageUrl: string | null;
		soldOut: boolean;
		modifierGroups: {
			id: string;
			name: string;
			selection: "SINGLE" | "MULTIPLE";
			required: boolean;
			options: { id: string; name: string; priceDelta: Satang; isDefault: boolean }[];
		}[];
	}[];
}

export type GuestProductDto = GuestMenuDto["products"][number];

export interface GuestTabDto {
	open: boolean;
	lines: { name: string; quantity: number; lineTotal: Satang; modifiers: string[]; note: string | null; round: number; ready: boolean }[];
	total: Satang;
	/** Rounds still waiting for staff, and ones they turned down. */
	requests: TableRequestDto[];
}

async function call<T>(path: string, init?: { method?: string; body?: unknown; signal?: AbortSignal }): Promise<T> {
	const response = await fetch(`${env.apiBaseUrl}/public/tables/${path}`, {
		method: init?.method ?? "GET",
		headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
		body: init?.body === undefined ? undefined : JSON.stringify(init.body),
		signal: init?.signal,
		cache: "no-store",
	}).catch((error: unknown) => {
		if (error instanceof DOMException && error.name === "AbortError") throw error;
		throw new BackendError(messages.apiErrors.network, 0);
	});
	const payload = (await response.json().catch(() => null)) as { data?: T; message?: string } | null;
	if (!response.ok) {
		const raw = payload?.message ?? response.statusText;
		throw new BackendError(friendlyMessage(response.status, raw), response.status, raw);
	}
	return payload?.data as T;
}

const token = (value: string) => encodeURIComponent(value);

export const guestApi = {
	menu: (qrToken: string, signal?: AbortSignal) => call<GuestMenuDto>(token(qrToken), { signal }),
	tab: (qrToken: string, signal?: AbortSignal) => call<GuestTabDto>(`${token(qrToken)}/tab`, { signal }),
	send: (
		qrToken: string,
		clientRequestId: string,
		items: { productId: string; quantity: number; modifierOptionIds: string[]; note?: string }[]
	) => call<GuestTabDto>(`${token(qrToken)}/requests`, { method: "POST", body: { clientRequestId, items } }),
};
