import { MigrationInterface, QueryRunner } from "typeorm";

/** A guest's round from a table's QR rings the bell too, not only a toast on open screens. */
export class TableRequestNotification1790810000000 implements MigrationInterface {
	name = "TableRequestNotification1790810000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TYPE "public"."notification_kind_enum" ADD VALUE IF NOT EXISTS 'TABLE_REQUEST'`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Postgres cannot drop an enum value; remove the rows so nothing reads it.
		await queryRunner.query(
			`DELETE FROM "notification" WHERE kind = 'TABLE_REQUEST'`
		);
	}
}
