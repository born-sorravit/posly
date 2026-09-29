/**
 * Mirrors the backend's response contract.
 *
 * The two apps are separate repos, so there is no shared package — these types are kept in
 * step with `apps/api/src/shared/interfaces/response.interface.ts` by hand.
 */
export interface PaginationMeta {
	total: number;
	page: number;
	last_page: number;
	limit: number;
}

export interface ApiEnvelope<T> {
	status: "success" | "error";
	statusCode?: number;
	message: string | null;
	data: T;
	meta?: PaginationMeta;
}

export interface Paginated<T> {
	data: T[];
	meta: PaginationMeta;
}

export interface AuthUser {
	id: string;
	email: string;
	name: string;
	avatarUrl: string | null;
	provider: "PASSWORD" | "GOOGLE";
	isVerified: boolean;
	locale: string;
}
