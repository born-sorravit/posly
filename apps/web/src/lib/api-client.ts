import { env } from "@/lib/env";
import type { ApiEnvelope, Paginated } from "@posly/types/api";

export class ApiError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
		this.name = "ApiError";
	}
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
	body?: unknown;
	/** Query string values; null/undefined/empty entries are dropped. */
	query?: Record<string, string | number | boolean | (string | number)[] | null | undefined>;
	token?: string;
}

const buildUrl = (path: string, query?: RequestOptions["query"]): string => {
	const url = new URL(`${env.apiBaseUrl}${path}`);

	for (const [key, value] of Object.entries(query ?? {})) {
		if (value === null || value === undefined || value === "") continue;
		// Repeat the key for arrays: ?province=1&province=2, which class-validator reads as
		// an array without any custom parsing on the backend.
		if (Array.isArray(value)) {
			for (const item of value) url.searchParams.append(key, String(item));
		} else {
			url.searchParams.set(key, String(value));
		}
	}

	return url.toString();
};

const request = async <T>(
	path: string,
	options: RequestOptions
): Promise<ApiEnvelope<T> | null> => {
	const { body, query, token, headers, ...init } = options;

	const response = await fetch(buildUrl(path, query), {
		...init,
		headers: {
			// Only on requests that actually carry a body: setting it on a GET turns every
			// cross-origin read into a CORS preflight, i.e. two round trips instead of one.
			...(body === undefined ? {} : { "Content-Type": "application/json" }),
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...headers,
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});

	const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

	if (!response.ok) {
		throw new ApiError(payload?.message ?? response.statusText, response.status);
	}

	return payload;
};

/**
 * Single entry point for talking to the API. It unwraps the `{ status, message, data }`
 * envelope so callers only ever see the payload, and turns a non-2xx response into an
 * `ApiError` carrying the backend's own message.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
	const payload = await request<T>(path, options);
	return payload?.data as T;
}

/** Same, but keeps the pagination meta the envelope carries alongside `data`. */
export async function apiFetchPaginated<T>(
	path: string,
	options: RequestOptions = {}
): Promise<Paginated<T>> {
	const payload = await request<T[]>(path, options);

	return {
		data: payload?.data ?? [],
		meta: payload?.meta ?? { total: 0, page: 1, last_page: 0, limit: 20 },
	};
}
