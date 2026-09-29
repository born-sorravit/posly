import { BaseEntity } from "@/models/base.entity";
import { BusinessType } from "@/shared/enums/business-type.enum";
import { Column, Entity } from "typeorm";

/**
 * The tenant. Every piece of shop data — branches, products, orders, members — hangs off a
 * `businessId`, and every query for it is scoped by one.
 */
@Entity("business")
export class Business extends BaseEntity {
	@Column({ type: "varchar", length: 120 })
	name: string;

	@Column({ name: "business_type", type: "enum", enum: BusinessType })
	businessType: BusinessType;

	/**
	 * Object path in Supabase Storage (`<businessId>/logo/<uuid>.png`), not a URL: the public
	 * URL is derived from config, so moving the bucket or project changes no rows.
	 */
	@Column({ name: "logo_path", type: "varchar", length: 300, nullable: true })
	logoPath: string | null;

	@Column({ type: "varchar", length: 30, nullable: true })
	phone: string | null;

	@Column({ type: "text", nullable: true })
	address: string | null;

	@Column({ name: "tax_id", type: "varchar", length: 20, nullable: true })
	taxId: string | null;

	/** Mobile number or 13-digit tax id the POS encodes into its PromptPay QR. */
	@Column({ name: "promptpay_id", type: "varchar", length: 20, nullable: true })
	promptPayId: string | null;

	/** ISO 4217. Amounts are stored in this currency's minor unit. */
	@Column({ type: "char", length: 3, default: "THB" })
	currency: string;

	/** Decides where "today" starts and ends for reports. */
	@Column({ type: "varchar", length: 64, default: "Asia/Bangkok" })
	timezone: string;

	/** VAT in basis points (700 = 7%). 0 for a shop that is not VAT-registered. */
	@Column({ name: "vat_basis_points", type: "int", default: 0 })
	vatBasisPoints: number;

	/** Whether listed prices already include VAT — the norm for Thai retail. */
	@Column({ name: "prices_include_vat", type: "boolean", default: true })
	pricesIncludeVat: boolean;

	/**
	 * Last order number issued. Incremented with `UPDATE … RETURNING` inside the checkout
	 * transaction, so the row lock serialises concurrent tills and numbers never collide.
	 */
	@Column({ name: "order_seq", type: "int", default: 0 })
	orderSeq: number;

	/** Set when the owner finishes onboarding; the frontend routes on it. */
	/** Receipt settings (plan §24): the line printed under the total, and what the header shows. */
	@Column({ name: "receipt_footer", type: "varchar", length: 300, nullable: true })
	receiptFooter: string | null;

	@Column({ name: "receipt_show_logo", type: "boolean", default: true })
	receiptShowLogo: boolean;

	@Column({ name: "receipt_show_tax_id", type: "boolean", default: true })
	receiptShowTaxId: boolean;

	@Column({ name: "onboarded_at", type: "timestamptz", nullable: true })
	onboardedAt: Date | null;
}
