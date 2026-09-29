import { csvField, fileSlug, ordersToCsv, periodSlug, salesFileName, toCsv } from "@/lib/export/csv";
import type { Order } from "@posly/types/domain";
import { describe, expect, it } from "vitest";

const labels = {
	headers: {
		number: "เลขที่",
		date: "วันที่",
		time: "เวลา",
		employee: "พนักงาน",
		customer: "ลูกค้า",
		method: "ช่องทาง",
		items: "รายการ",
		quantity: "จำนวน",
		subtotal: "รวมสินค้า",
		discount: "ส่วนลด",
		vat: "VAT",
		total: "ยอดรวม",
		status: "สถานะ",
	},
	method: (m: string) => (m === "CASH" ? "เงินสด" : m),
	status: (s: string) => (s === "PAID" ? "สำเร็จ" : s),
};

const order = (overrides: Partial<Order> = {}): Order => ({
	id: "o1",
	number: "003064",
	// 14:14 in Bangkok, 07:14 UTC — the sheet must show shop time, not UTC.
	createdAt: "2026-09-28T07:14:00.000Z",
	employeeName: "ป้าแดง",
	paymentMethod: "CASH",
	status: "PAID",
	items: [
		{
			id: "i1",
			productId: "p1",
			name: "Latte",
			art: "latte",
			quantity: 2,
			unitPrice: 7000,
			modifiers: [{ groupName: "ขนาด", optionName: "L", priceDelta: 1000 }],
			note: null,
			lineTotal: 16000,
		},
		{ id: "i2", productId: "p2", name: "Croissant", art: "croissant", quantity: 1, unitPrice: 6500, modifiers: [], note: null, lineTotal: 6500 },
	],
	subtotal: 22500,
	discount: 1250,
	vat: 0,
	total: 21250,
	received: null,
	change: null,
	customerName: null,
	...overrides,
});

describe("csv", () => {
	it("quotes separators and quotes, and defuses spreadsheet formulas", () => {
		expect(csvField("a,b")).toBe('"a,b"');
		expect(csvField('say "hi"')).toBe('"say ""hi"""');
		expect(csvField("line\nbreak")).toBe('"line\nbreak"');
		expect(csvField("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
		expect(csvField(null)).toBe("");
		expect(csvField(12.5)).toBe("12.5");
	});

	it("starts with a BOM so Excel reads Thai as UTF-8", () => {
		expect(toCsv([["ไทย"]]).startsWith("﻿")).toBe(true);
	});

	it("writes one row per order in shop time, baht as plain numbers", () => {
		const [header, row] = ordersToCsv([order()], labels).replace("﻿", "").trim().split("\r\n");
		expect(header.split(",")).toHaveLength(13);
		expect(row).toBe(
			'003064,2026-09-28,14:14,ป้าแดง,,เงินสด,"Latte (L) ×2, Croissant ×1",3,225,12.5,0,212.5,สำเร็จ'
		);
	});

	it("merges lines that read the same, like one product with two notes", () => {
		const cookie = { ...order().items[1], name: "คุกกี้กล่อง" };
		const csv = ordersToCsv(
			[order({ items: [cookie, { ...cookie, id: "i3", note: "ใส่ถุง" }, { ...cookie, id: "i4", name: "มาม่า" }] })],
			labels
		);
		expect(csv).toContain('"คุกกี้กล่อง ×2, มาม่า ×1"');
	});

	it("names the file after the day, or the range, in Bangkok time", () => {
		expect(periodSlug("2026-09-27T17:00:00.000Z", "2026-09-28T17:00:00.000Z")).toBe("2026-09-28");
		expect(periodSlug("2026-09-21T17:00:00.000Z", "2026-09-28T17:00:00.000Z")).toBe("2026-09-22_2026-09-28");
	});
});

describe("salesFileName", () => {
	const period = { from: "2026-09-27T17:00:00.000Z", to: "2026-09-28T17:00:00.000Z" };

	it("names the period, or the customer when filtering by one", () => {
		expect(salesFileName(period)).toBe("posly-sales-2026-09-28.csv");
		expect(salesFileName(period, "คุณพลอย")).toBe("posly-sales-คุณพลอย.csv");
	});

	it("drops characters file systems refuse", () => {
		expect(fileSlug("คุณพลอย / VIP: A*")).toBe("คุณพลอย-VIP-A");
		expect(fileSlug(" ?? ")).toBe("customer");
	});
});

describe("ordersToCsv with a tag column", () => {
	it("puts the tag right after the number", () => {
		const csv = ordersToCsv([order()], { ...labels, tag: { header: "ป้าย", of: () => "กลับบ้าน · คิว 7" } });
		const [header, row] = csv.replace(/^\uFEFF/, "").split("\r\n");
		expect(header.split(",").slice(0, 2)).toEqual(["เลขที่", "ป้าย"]);
		expect(row).toContain("กลับบ้าน · คิว 7");
	});
});
