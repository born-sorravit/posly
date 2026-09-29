export interface PaginationMeta {
	total: number;
	page: number;
	last_page: number;
	limit: number;
}

export interface ApiResponse<T> {
	status?: "success" | "error";
	statusCode?: number;
	message?: string | null;
	data: T;
	meta?: PaginationMeta;
}

export interface ErrorResponse {
	status: "error";
	statusCode: number;
	message: string;
	/** Facts a client may act on, when the error has any (attempts left, a lock's end). */
	details?: Record<string, unknown>;
}
