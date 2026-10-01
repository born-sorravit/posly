import { MigrationInterface, QueryRunner } from "typeorm";

/** Staff sending a round onto a table from the till rings the bell too. */
export class TableRoundNotification1790850000000 implements MigrationInterface {
	name = "TableRoundNotification1790850000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TYPE "public"."notification_kind_enum" ADD VALUE IF NOT EXISTS 'TABLE_ROUND'`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Postgres cannot drop an enum value; remove the rows so nothing reads it.
		await queryRunner.query(`DELETE FROM "notification" WHERE kind = 'TABLE_ROUND'`);
	}
}
