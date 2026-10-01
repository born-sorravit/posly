import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Guests may open a free table themselves by ordering from its QR (on by default); and a tab
 * a guest opened has no member behind it.
 */
export class TableSelfOpen1790800000000 implements MigrationInterface {
	name = "TableSelfOpen1790800000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "business" ADD "table_self_open" boolean NOT NULL DEFAULT true`
		);
		await queryRunner.query(
			`ALTER TABLE "table_session" ALTER COLUMN "opened_by_member_id" DROP NOT NULL`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`DELETE FROM "table_session" WHERE "opened_by_member_id" IS NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "table_session" ALTER COLUMN "opened_by_member_id" SET NOT NULL`
		);
		await queryRunner.query(`ALTER TABLE "business" DROP COLUMN "table_self_open"`);
	}
}
