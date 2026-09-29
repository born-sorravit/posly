"use client";

import { useState } from "react";

/** The slice for a page, clamped so a shrinking list never leaves you on an empty page. */
export const pageSlice = (total: number, requested: number, pageSize: number) => {
	const lastPage = Math.max(1, Math.ceil(total / pageSize));
	const page = Math.min(Math.max(1, requested), lastPage);
	const start = (page - 1) * pageSize;
	return { page, lastPage, start, end: Math.min(start + pageSize, total) };
};

/**
 * Client-side paging for lists the API returns whole (products, stock, customers). The page
 * belongs to one `resetKey` — the filters that produced `rows` — so changing a filter or a
 * search starts again from page 1, with no effect resetting state after the fact.
 */
export function usePagedRows<T>(rows: T[], resetKey: string, pageSize = 20) {
	const [paging, setPaging] = useState({ key: resetKey, page: 1 });
	const requested = paging.key === resetKey ? paging.page : 1;
	const { page, lastPage, start, end } = pageSlice(rows.length, requested, pageSize);

	return {
		pageRows: rows.slice(start, end),
		page,
		lastPage,
		total: rows.length,
		from: rows.length === 0 ? 0 : start + 1,
		to: end,
		goTo: (next: number) => {
			setPaging({ key: resetKey, page: next });
			window.scrollTo({ top: 0, behavior: "smooth" });
		},
	};
}
