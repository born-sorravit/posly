import { MigrationInterface, QueryRunner } from "typeorm";

/** Adds shipped highlights after the plan's other shipped ones, before any "coming soon". */
const append = (code: string, labels: string[]) =>
	`UPDATE "subscription_plan" p SET "highlights" = (
		SELECT jsonb_agg(x.value ORDER BY x.grp, x.ord) FROM (
			SELECT h.value, h.ord, CASE WHEN (h.value ->> 'soon')::boolean THEN 2 ELSE 0 END AS grp
			FROM jsonb_array_elements(p.highlights) WITH ORDINALITY AS h(value, ord)
			UNION ALL
			SELECT n.value, n.ord, 1 FROM jsonb_array_elements('${JSON.stringify(
				labels.map((label) => ({ label, soon: false }))
			)}'::jsonb) WITH ORDINALITY AS n(value, ord)
		) x
	) WHERE p."code" = '${code}'`;

const drop = (code: string, labels: string[]) =>
	`UPDATE "subscription_plan" p SET "highlights" = COALESCE((
		SELECT jsonb_agg(h.value ORDER BY h.ord)
		FROM jsonb_array_elements(p.highlights) WITH ORDINALITY AS h(value, ord)
		WHERE NOT (h.value ->> 'label' = ANY(ARRAY[${labels.map((l) => `'${l}'`).join(", ")}]))
	), '[]'::jsonb) WHERE p."code" = '${code}'`;

/**
 * Tables and QR ordering join the plans: table tabs from Starter (10 tables), guests ordering
 * from the QR from Pro (30 tables), unlimited on Business. The kitchen screen moves down to
 * Pro, since QR rounds need somewhere for the kitchen to see them.
 */
export class TablePlans1790830000000 implements MigrationInterface {
	name = "TablePlans1790830000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "subscription_plan" ADD "table_limit" integer`
		);
		await queryRunner.query(
			`UPDATE "subscription_plan" SET "table_limit" = 0 WHERE "code" = 'FREE'`
		);
		await queryRunner.query(
			`UPDATE "subscription_plan" SET "table_limit" = 10 WHERE "code" = 'STARTER'`
		);
		await queryRunner.query(
			`UPDATE "subscription_plan" SET "table_limit" = 30 WHERE "code" = 'PRO'`
		);

		for (const [plan, feature] of [
			["STARTER", "TABLES"],
			["PRO", "TABLES"],
			["BUSINESS", "TABLES"],
			["PRO", "QR_ORDERING"],
			["BUSINESS", "QR_ORDERING"],
			["PRO", "KITCHEN_DISPLAY"],
		]) {
			await queryRunner.query(
				`INSERT INTO "plan_feature" ("plan_code", "feature") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
				[plan, feature]
			);
		}

		await queryRunner.query(append("STARTER", ["โต๊ะและบิลโต๊ะ (10 โต๊ะ)"]));
		await queryRunner.query(
			append("PRO", ["ลูกค้าสั่งเองผ่าน QR", "จอครัว (Kitchen Display)", "โต๊ะ 30 โต๊ะ"])
		);
		await queryRunner.query(drop("BUSINESS", ["Kitchen Display"]));
		await queryRunner.query(append("BUSINESS", ["โต๊ะไม่จำกัด"]));
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(drop("BUSINESS", ["โต๊ะไม่จำกัด"]));
		await queryRunner.query(append("BUSINESS", ["Kitchen Display"]));
		await queryRunner.query(
			drop("PRO", ["ลูกค้าสั่งเองผ่าน QR", "จอครัว (Kitchen Display)", "โต๊ะ 30 โต๊ะ"])
		);
		await queryRunner.query(drop("STARTER", ["โต๊ะและบิลโต๊ะ (10 โต๊ะ)"]));
		await queryRunner.query(
			`DELETE FROM "plan_feature" WHERE "feature" IN ('TABLES', 'QR_ORDERING')
			    OR ("plan_code" = 'PRO' AND "feature" = 'KITCHEN_DISPLAY')`
		);
		await queryRunner.query(
			`ALTER TABLE "subscription_plan" DROP COLUMN "table_limit"`
		);
	}
}
