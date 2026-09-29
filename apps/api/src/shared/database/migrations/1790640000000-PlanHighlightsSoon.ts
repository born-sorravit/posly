import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Pricing-card lines become `{ label, soon }`, so a plan can promise a feature before it
 * ships without the card claiming it works today. Flip `soon` off when it ships.
 */
const SOON = ["แจ้งเตือน LINE", "Kitchen Display", "สิทธิ์ขั้นสูง", "ซัพพอร์ตก่อนใคร"];

export class PlanHighlightsSoon1790640000000 implements MigrationInterface {
	name = "PlanHighlightsSoon1790640000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`UPDATE "subscription_plan" p SET "highlights" = (
				SELECT COALESCE(jsonb_agg(
					jsonb_build_object('label', h.value, 'soon', h.value = ANY($1::text[]))
					ORDER BY h.ord), '[]'::jsonb)
				FROM jsonb_array_elements_text(p.highlights) WITH ORDINALITY AS h(value, ord))
			WHERE jsonb_typeof(p.highlights -> 0) = 'string'`,
			[SOON]
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`UPDATE "subscription_plan" p SET "highlights" = (
				SELECT COALESCE(jsonb_agg(h.value -> 'label' ORDER BY h.ord), '[]'::jsonb)
				FROM jsonb_array_elements(p.highlights) WITH ORDINALITY AS h(value, ord))
			WHERE jsonb_typeof(p.highlights -> 0) = 'object'`
		);
	}
}
