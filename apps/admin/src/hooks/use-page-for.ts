import { useCallback, useState } from "react";

/**
 * A page number that falls back to 1 whenever `key` (the serialised filters) changes, so a
 * new search never lands on an empty page 7. Derived during render — no reset effect.
 */
export function usePageFor(key: string) {
	const [state, setState] = useState({ key, page: 1 });
	const page = state.key === key ? state.page : 1;
	const setPage = useCallback((next: number) => setState({ key, page: next }), [key]);
	return [page, setPage] as const;
}
