import { Business } from "@/models/businesses/entities/business.entity";
import type { OrderResponse } from "@/modules/orders/dto/order.dto";
import { OrdersService } from "@/modules/orders/orders.service";
import { StorageService } from "@/modules/storage/storage.service";
import type { ResolvedMembership } from "@/shared/decorators/current-membership.decorator";
import { OrderStatus, PaymentMethod, ServiceType } from "@/shared/enums/order.enum";
import { MailService } from "@/shared/mail/mail.service";
import { Injectable, NotFoundException } from "@nestjs/common";
import { DataSource } from "typeorm";

const METHOD: Record<PaymentMethod, string> = {
	[PaymentMethod.CASH]: "เงินสด",
	[PaymentMethod.PROMPTPAY]: "PromptPay",
	[PaymentMethod.CARD]: "บัตรเครดิต/เดบิต",
	[PaymentMethod.OTHER]: "อื่นๆ",
};
const SERVICE: Record<ServiceType, string> = {
	[ServiceType.DINE_IN]: "ทานที่ร้าน",
	[ServiceType.TAKEAWAY]: "กลับบ้าน",
	[ServiceType.DELIVERY]: "เดลิเวอรี",
};

const baht = (satang: number) =>
	`฿${new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(satang / 100)}`;

/** Everything interpolated into the HTML came from someone's keyboard: escape it. */
const esc = (value: string | null | undefined) =>
	(value ?? "").replace(
		/[&<>"']/g,
		(c) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				c
			] as string
	);

const when = (iso: string, timezone: string) =>
	new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
		day: "numeric",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
		timeZone: timezone,
	}).format(new Date(iso));

/**
 * The receipt, by email (plan §24): the same facts as the printed slip — shop, order, lines,
 * totals, payment, footer — as a narrow HTML email with a plain-text twin.
 */
@Injectable()
export class ReceiptMailService {
	constructor(
		private readonly orders: OrdersService,
		private readonly mail: MailService,
		private readonly storage: StorageService,
		private readonly dataSource: DataSource
	) {}

	async send(
		membership: ResolvedMembership,
		orderId: string,
		email: string
	): Promise<{ delivered: boolean }> {
		// The same visibility as viewing it: a cashier can only send their own sales.
		const order = await this.orders.findOne(membership, orderId);
		const business = await this.dataSource
			.getRepository(Business)
			.findOne({ where: { id: membership.businessId } });
		if (!business) throw new NotFoundException("Business not found");
		await this.mail.send({ to: email, ...this.compose(order, business) });
		return { delivered: this.mail.configured };
	}

	compose(
		order: OrderResponse,
		business: Business
	): { subject: string; html: string; text: string } {
		const taxInvoice =
			business.vatBasisPoints > 0 &&
			business.receiptShowTaxId &&
			Boolean(business.taxId);
		const tag = [order.serviceType ? SERVICE[order.serviceType] : null, order.label]
			.filter(Boolean)
			.join(" · ");
		const reversed =
			order.status === OrderStatus.REFUNDED ||
			order.status === OrderStatus.CANCELLED;
		const logo =
			business.receiptShowLogo && business.logoPath
				? this.storage.publicUrl(business.logoPath)
				: null;
		const footer = business.receiptFooter || "ขอบคุณที่ใช้บริการ";
		const rows: [string, string][] = [
			["เลขที่", `#${order.number}`],
			...(tag ? [["ประเภท", tag] as [string, string]] : []),
			["วันที่", when(order.createdAt, business.timezone)],
			["พนักงาน", order.employeeName],
			...(order.customerName
				? [["ลูกค้า", order.customerName] as [string, string]]
				: []),
		];
		const totals: [string, string, boolean?][] = [
			["รวมเป็นเงิน", baht(order.subtotal)],
			...(order.discount > 0
				? [["ส่วนลด", `-${baht(order.discount)}`] as [string, string]]
				: []),
			...(business.vatBasisPoints > 0
				? [
						[`VAT ${business.vatBasisPoints / 100}%`, baht(order.vat)] as [
							string,
							string,
						],
					]
				: []),
			["ยอดสุทธิ", baht(order.total), true],
		];
		const payment: [string, string][] = [
			["ชำระโดย", METHOD[order.paymentMethod]],
			...(order.received !== null
				? [["รับเงิน", baht(order.received)] as [string, string]]
				: []),
			...(order.change !== null
				? [["เงินทอน", baht(order.change)] as [string, string]]
				: []),
		];

		const row = ([label, value, strong]: [string, string, boolean?]) =>
			`<tr><td style="padding:2px 0;color:#64748b">${esc(label)}</td><td style="padding:2px 0;text-align:right;${strong ? "font-weight:700;font-size:16px;color:#111827" : ""}">${esc(value)}</td></tr>`;
		const rule =
			'<tr><td colspan="2" style="padding:10px 0"><div style="border-top:1px dashed #cbd5e1"></div></td></tr>';
		const lines = order.items
			.map((item) => {
				const options = item.modifiers.map((m) => m.optionName).join(", ");
				return `<tr><td style="padding:3px 0">${esc(item.name)} × ${item.quantity}${options ? `<div style="color:#64748b;font-size:12px">${esc(options)}</div>` : ""}${item.note ? `<div style="color:#64748b;font-size:12px">${esc(item.note)}</div>` : ""}</td><td style="padding:3px 0;text-align:right;vertical-align:top">${baht(item.lineTotal)}</td></tr>`;
			})
			.join("");

		const html = `<!doctype html><html lang="th"><body style="margin:0;background:#f4f5f8;padding:24px 12px;font-family:-apple-system,'Segoe UI','Noto Sans Thai',Tahoma,sans-serif;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:420px;background:#ffffff;border-radius:16px;padding:24px;font-size:14px">
<tr><td colspan="2" style="text-align:center;padding-bottom:4px">
${logo ? `<img src="${esc(logo)}" width="48" height="48" alt="" style="border-radius:12px;margin-bottom:8px">` : ""}
<div style="font-weight:700;font-size:17px">${esc(business.name)}</div>
${business.address ? `<div style="color:#64748b;font-size:12px">${esc(business.address)}</div>` : ""}
${business.phone ? `<div style="color:#64748b;font-size:12px">โทร ${esc(business.phone)}</div>` : ""}
${business.receiptShowTaxId && business.taxId ? `<div style="color:#64748b;font-size:12px">เลขประจำตัวผู้เสียภาษี ${esc(business.taxId)}</div>` : ""}
${taxInvoice ? '<div style="font-weight:700;padding-top:6px">ใบกำกับภาษีอย่างย่อ</div>' : ""}
${reversed ? `<div style="margin-top:8px;display:inline-block;background:#fee2e2;color:#b91c1c;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:600">${order.status === OrderStatus.REFUNDED ? "คืนเงินแล้ว" : "ยกเลิกแล้ว"}</div>` : ""}
</td></tr>
${rule}${rows.map(row).join("")}${rule}${lines}${rule}${totals.map(row).join("")}${rule}${payment.map(row).join("")}${rule}
<tr><td colspan="2" style="text-align:center;padding-top:4px;white-space:pre-line">${esc(footer)}</td></tr>
<tr><td colspan="2" style="text-align:center;color:#94a3b8;font-size:11px;padding-top:12px">Powered by Posly</td></tr>
</table></td></tr></table></body></html>`;

		const text = [
			business.name,
			...(taxInvoice ? ["ใบกำกับภาษีอย่างย่อ"] : []),
			...(reversed
				? [order.status === OrderStatus.REFUNDED ? "(คืนเงินแล้ว)" : "(ยกเลิกแล้ว)"]
				: []),
			"",
			...rows.map(([l, v]) => `${l}: ${v}`),
			"",
			...order.items.map(
				(item) => `${item.name} × ${item.quantity}  ${baht(item.lineTotal)}`
			),
			"",
			...totals.map(([l, v]) => `${l}: ${v}`),
			...payment.map(([l, v]) => `${l}: ${v}`),
			"",
			footer,
		].join("\n");

		return { subject: `ใบเสร็จ #${order.number} จาก ${business.name}`, html, text };
	}
}
