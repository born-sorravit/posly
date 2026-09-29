import type { Satang } from "@posly/utils/money";
import type { Order, OrderStatus, PaymentMethod } from "@posly/types/domain";

const TZ = "Asia/Bangkok";

/**
 * One CSV field. Quoted when it holds a separator, quote or line break, with quotes doubled
 * (RFC 4180). A leading = + - @ is prefixed with ' so a spreadsheet shows it as text instead
 * of running it as a formula — an order note is typed by a customer-facing till.
 */
export const csvField = (value: string | number | null | undefined): string => {
	if (value === null || value === undefined) return "";
	if (typeof value === "number") return String(value);
	const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
	return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/**
 * Rows to a CSV document. It starts with a UTF-8 byte-order mark: without it Excel reads
 * the file as the system code page and every Thai character turns into mojibake.
 */
export const toCsv = (rows: (string | number | null | undefined)[][]): string =>
	`﻿${rows.map((row) => row.map(csvField).join(",")).join("\r\n")}\r\n`;

/** Satang to a plain baht number ("1250" -> 12.5) so a spreadsheet can sum the column. */
const baht = (amount: Satang) => amount / 100;

const dateOf = (iso: string) =>
	new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(
		new Date(iso)
	);
const timeOf = (iso: string) =>
	new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
		new Date(iso)
	);

/**
 * "Latte (L, หวาน 50%) ×2, Croissant ×1" — enough to recognise the order in a sheet. Lines
 * that read the same (the same product twice with different notes) are merged, since the
 * note is not in the sheet and "Cookie ×1, Cookie ×1" only looks like a mistake.
 */
export const orderItemLines = (order: Pick<Order, "items">) => {
	const counts = new Map<string, number>();
	for (const item of order.items) {
		const options = item.modifiers.map((m) => m.optionName).join(", ");
		const label = `${item.name}${options ? ` (${options})` : ""}`;
		counts.set(label, (counts.get(label) ?? 0) + item.quantity);
	}
	return [...counts].map(([label, quantity]) => ({ label, quantity }));
};

const itemSummary = (order: Order) =>
	orderItemLines(order)
		.map(({ label, quantity }) => `${label} ×${quantity}`)
		.join(", ");

export interface OrderCsvLabels {
	headers: {
		number: string;
		date: string;
		time: string;
		employee: string;
		customer: string;
		method: string;
		items: string;
		quantity: string;
		subtotal: string;
		discount: string;
		vat: string;
		total: string;
		status: string;
	};
	method: (method: PaymentMethod) => string;
	status: (status: OrderStatus) => string;
	/** "กลับบ้าน · คิว 12" — adds a column after the number when given. */
	tag?: { header: string; of: (order: Order) => string };
}

/** Orders as the sales sheet an owner hands to an accountant: one row per order. */
export const ordersToCsv = (orders: Order[], labels: OrderCsvLabels): string => {
	const h = labels.headers;
	const tag = labels.tag;
	return toCsv([
		[
			h.number,
			...(tag ? [tag.header] : []),
			h.date,
			h.time,
			h.employee,
			h.customer,
			h.method,
			h.items,
			h.quantity,
			h.subtotal,
			h.discount,
			h.vat,
			h.total,
			h.status,
		],
		...orders.map((o) => [
			o.number,
			...(tag ? [tag.of(o)] : []),
			dateOf(o.createdAt),
			timeOf(o.createdAt),
			o.employeeName,
			o.customerName,
			labels.method(o.paymentMethod),
			itemSummary(o),
			o.items.reduce((n, item) => n + item.quantity, 0),
			baht(o.subtotal),
			baht(o.discount),
			baht(o.vat),
			baht(o.total),
			labels.status(o.status),
		]),
	]);
};

/** Hands a generated file to the browser's download, then releases the blob. */
export const downloadFile = (filename: string, content: string, type = "text/csv;charset=utf-8") => {
	const url = URL.createObjectURL(new Blob([content], { type }));
	const link = Object.assign(document.createElement("a"), { href: url, download: filename });
	document.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 0);
};

/** "2026-09-28" for one day, "2026-09-22_2026-09-28" for a range; `to` is exclusive. */
export const periodSlug = (from: string, to: string) => {
	const first = dateOf(from);
	const last = dateOf(new Date(new Date(to).getTime() - 1).toISOString());
	return first === last ? first : `${first}_${last}`;
};

/**
 * A name as part of a file name: Thai and spaces-as-dashes kept, characters Windows or
 * macOS refuse dropped. "คุณพลอย / VIP" → "คุณพลอย-VIP".
 */
export const fileSlug = (name: string) =>
	name
		.normalize("NFC")
		.replace(/[\\/:*?"<>|#%\u0000-\u001f]/g, " ")
		.trim()
		.replace(/\s+/g, "-")
		.slice(0, 60) || "customer";

/** Sales export name: a customer's whole history, or the period on screen. */
export const salesFileName = (period: { from: string; to: string }, customerName?: string | null) =>
	customerName !== undefined && customerName !== null
		? `posly-sales-${fileSlug(customerName)}.csv`
		: `posly-sales-${periodSlug(period.from, period.to)}.csv`;
