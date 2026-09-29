import { MigrationInterface, QueryRunner } from "typeorm";

/** Custom permissions have shipped: the Business card stops calling them "coming soon". */
const setSoon = (label: string, soon: boolean) =>
	`UPDATE "subscription_plan" p SET "highlights" = (
		SELECT jsonb_agg(
			CASE WHEN h.value ->> 'label' = '${label}' THEN jsonb_set(h.value, '{soon}', '${soon}'::jsonb) ELSE h.value END
			ORDER BY h.ord)
		FROM jsonb_array_elements(p.highlights) WITH ORDINALITY AS h(value, ord))
	WHERE p.highlights @> '[{"label": "${label}"}]'`;

export class AdvancedPermissionShipped1790670000000 implements MigrationInterface {
	name = "AdvancedPermissionShipped1790670000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(setSoon("สิทธิ์ขั้นสูง", false));
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(setSoon("สิทธิ์ขั้นสูง", true));
	}
}
