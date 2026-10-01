import messages from "@/../messages/th.json";
import type { ApiEnvelope, Paginated } from "@posly/types/api";

const text = messages.apiErrors;

/**
 * The API speaks English to developers; the cashier should not have to. Known messages are
 * translated, anything unrecognised falls back to a Thai message for its status, and the
 * original stays on the error for logs.
 */
const KNOWN: [RegExp, (match: RegExpMatchArray) => string][] = [
	// Usually another till sold the last units a moment earlier.
	[/^(.+) is out of stock$/, (m) => `${m[1]} สต็อกไม่พอแล้ว (อาจถูกขายจากเครื่องอื่น) ลดจำนวนในตะกร้าแล้วลองใหม่`],
	[/^Only (\d+) in stock$/, (m) => `มีสต็อกเหลือแค่ ${m[1]} เบิกออกเกินกว่านี้ไม่ได้`],
	[/^Your plan does not include (\w+)$/, () => "ฟีเจอร์นี้อยู่ในแพ็กเกจที่สูงกว่า อัปเกรดได้ที่ตั้งค่า › แพ็กเกจ"],
	[/^Monthly order limit of (\d+) reached$/, (m) => `ครบ ${m[1]} ออเดอร์ของเดือนนี้ตามแพ็กเกจแล้ว อัปเกรดเพื่อขายต่อได้ไม่จำกัด`],
	[/^Plan allows up to (\d+) employees$/, (m) => `แพ็กเกจนี้มีพนักงานได้สูงสุด ${m[1]} คน`],
	[/^Plan allows up to (\d+) branches$/, (m) => `แพ็กเกจนี้มีได้สูงสุด ${m[1]} สาขา`],
	[/^Plan allows up to (\d+) tables$/, (m) => `แพ็กเกจนี้มีโต๊ะได้สูงสุด ${m[1]} โต๊ะ อัปเกรดเพื่อเพิ่มโต๊ะ`],
	[/^This shop does not take orders from the QR$/, () => "ร้านนี้ยังไม่รับคำสั่งผ่าน QR สั่งกับพนักงานได้เลย"],
	[/^Cash received is less than the total$/, () => "รับเงินน้อยกว่ายอดชำระ"],
	[/^You are not allowed to give discounts$/, () => "คุณไม่มีสิทธิ์ให้ส่วนลด"],
	[/^SKU is already used/, () => "SKU นี้ถูกใช้กับสินค้าอื่นแล้ว"],
	[/^This email is already a member$/, () => "อีเมลนี้เป็นพนักงานของร้านอยู่แล้ว"],
	[/^You are already a member of this shop$/, () => "คุณเป็นพนักงานของร้านนี้อยู่แล้ว"],
	[/invitation has (already been used|expired)/i, () => "ลิงก์เชิญนี้หมดอายุหรือถูกใช้ไปแล้ว"],
	[/^Order is already (\w+)$/, () => "ออเดอร์นี้ถูกคืนเงินหรือยกเลิกไปแล้ว"],
	[/^This table is not open for ordering$/, () => "โต๊ะนี้ยังไม่เปิดรับคำสั่ง แจ้งพนักงานเพื่อเปิดโต๊ะ"],
	[/^Please wait for staff to confirm your last order$/, () => "รอพนักงานยืนยันคำสั่งก่อนหน้าก่อน แล้วค่อยสั่งเพิ่ม"],
	[/^This table is already open$/, () => "โต๊ะนี้เปิดอยู่แล้ว"],
	[/^This table is turned off$/, () => "โต๊ะนี้ปิดใช้งานอยู่"],
	[/^This tab is already closed$/, () => "บิลนี้ปิดไปแล้ว"],
	[/^Nothing on this tab yet/, () => "ยังไม่มีรายการในบิล ใช้ยกเลิกบิลแทน"],
	[/^Request is already (\w+)$/, () => "คำสั่งนี้มีคนจัดการไปแล้ว"],
	[/^A table with this name already exists$/, () => "มีโต๊ะชื่อนี้อยู่แล้ว"],
	[/^Close the table's tab before/, () => "ปิดบิลของโต๊ะนี้ก่อน"],
	[/^You are not allowed to cancel orders$/, () => "คุณไม่มีสิทธิ์ยกเลิกออเดอร์"],
	[/^(.+) is required for (.+)$/, (m) => `กรุณาเลือก${m[1]}ของ ${m[2]}`],
	[/reset link has expired or was already used/i, () => "ลิงก์นี้หมดอายุหรือถูกใช้ไปแล้ว ขอลิงก์ใหม่ได้ที่หน้าลืมรหัสผ่าน"],
	[/^Incorrect email or password$/, () => "อีเมลหรือรหัสผ่านไม่ถูกต้อง"],
	[/^Current password is incorrect$/, () => "รหัสผ่านปัจจุบันไม่ถูกต้อง"],
	[/^The new password must be different from the current one$/, () => "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม"],
	[/^Password must not be consecutive digits$/, () => "รหัสผ่านห้ามเป็นตัวเลขเรียงกัน"],
	[/^Password must not contain your name or email$/, () => "รหัสผ่านไม่ควรมีชื่อหรืออีเมลของคุณ"],
	[/^Password must be at most \d+ bytes$/, () => "รหัสผ่านยาวเกินไป"],
	[/^Invalid Google token$/, () => "เข้าสู่ระบบด้วย Google ไม่สำเร็จ ลองใหม่อีกครั้ง"],
	[/^Google sign-in is not configured$/, () => "ยังไม่ได้เปิดการเข้าสู่ระบบด้วย Google"],
	[/^An account with this email already exists$/, () => "อีเมลนี้มีบัญชีอยู่แล้ว"],
	[/^Image uploads are not configured$/, () => "ยังไม่ได้ตั้งค่าการอัปโหลดรูป"],
	// The demo guard and demo login already answer in Thai.
	[/^บัญชีทดลอง/, (m) => m.input ?? ""],
];

export const friendlyMessage = (status: number, message: string | undefined): string => {
	for (const [pattern, render] of KNOWN) {
		const match = message?.match(pattern);
		if (match) return render(match);
	}
	if (status === 403) return text.forbidden;
	if (status === 401) return text.unauthorized;
	if (status === 404) return text.notFound;
	if (status === 429) return text.tooMany;
	if (status >= 500) return text.server;
	return message ?? text.server;
};

/**
 * Browser → API, through the `/api/backend` proxy.
 *
 * The session lives in httpOnly cookies the page cannot read, so every authenticated call is
 * made to our own origin and the proxy attaches the bearer token (and refreshes it on a 401).
 * This module only unwraps the `{ status, message, data }` envelope and turns non-2xx into
 * a `BackendError` carrying the API's own message.
 */
const PROXY = "/api/backend";

export class BackendError extends Error {
	constructor(
		message: string,
		readonly status: number,
		/** The API's own wording, for logs. */
		readonly raw?: string
	) {
		super(message);
		this.name = "BackendError";
	}
}

type Query = Record<string, string | number | boolean | null | undefined>;

const url = (path: string, query?: Query) => {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query ?? {})) {
		if (value !== null && value !== undefined && value !== "") params.set(key, String(value));
	}
	const qs = params.toString();
	return `${PROXY}${path}${qs ? `?${qs}` : ""}`;
};

async function call<T>(
	path: string,
	init: { method?: string; body?: unknown; query?: Query; signal?: AbortSignal } = {}
): Promise<ApiEnvelope<T>> {
	const response = await fetch(url(path, init.query), {
		method: init.method ?? "GET",
		headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
		body: init.body === undefined ? undefined : JSON.stringify(init.body),
		signal: init.signal,
	}).catch((error: unknown) => {
		if (error instanceof DOMException && error.name === "AbortError") throw error;
		throw new BackendError(text.network, 0);
	});
	const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
	if (!response.ok) {
		const raw = payload?.message ?? response.statusText;
		throw new BackendError(friendlyMessage(response.status, raw), response.status, raw);
	}
	// 204 No Content has no envelope at all.
	return (payload ?? { data: undefined }) as ApiEnvelope<T>;
}

export const backend = {
	get: async <T>(path: string, query?: Query, signal?: AbortSignal) =>
		(await call<T>(path, { query, signal })).data,

	page: async <T>(path: string, query?: Query, signal?: AbortSignal): Promise<Paginated<T>> => {
		const payload = await call<T[]>(path, { query, signal });
		return {
			data: payload.data ?? [],
			meta: payload.meta ?? { total: 0, page: 1, last_page: 0, limit: 20 },
		};
	},

	post: async <T>(path: string, body?: unknown) =>
		(await call<T>(path, { method: "POST", body: body ?? {} })).data,

	patch: async <T>(path: string, body: unknown) =>
		(await call<T>(path, { method: "PATCH", body })).data,

	put: async <T>(path: string, body: unknown) => (await call<T>(path, { method: "PUT", body })).data,

	delete: async <T>(path: string) => (await call<T>(path, { method: "DELETE" })).data,
};
