import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * A guest at a table can call for staff or ask for the bill from its QR. The call stays on
 * the table until staff acknowledge it (or the tab closes), and rings the bell.
 */
export class TableCalls1790840000000 implements MigrationInterface {
	name = "TableCalls1790840000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TYPE "public"."notification_kind_enum" ADD VALUE IF NOT EXISTS 'TABLE_CALL'`
		);
		await queryRunner.query(
			`ALTER TABLE "dining_table" ADD "call_kind" character varying(10)`
		);
		await queryRunner.query(
			`ALTER TABLE "dining_table" ADD "called_at" TIMESTAMP WITH TIME ZONE`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "dining_table" DROP COLUMN "called_at"`);
		await queryRunner.query(`ALTER TABLE "dining_table" DROP COLUMN "call_kind"`);
		// Postgres cannot drop an enum value; remove the rows so nothing reads it.
		await queryRunner.query(`DELETE FROM "notification" WHERE kind = 'TABLE_CALL'`);
	}
}
