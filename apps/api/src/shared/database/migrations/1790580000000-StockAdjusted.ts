import { MigrationInterface, QueryRunner } from "typeorm";

export class StockAdjusted1790580000000 implements MigrationInterface {
	name = "StockAdjusted1790580000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TYPE "public"."audit_log_action_enum" ADD VALUE IF NOT EXISTS 'STOCK_ADJUSTED'`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Postgres cannot drop one enum value; rebuild the type without it.
		await queryRunner.query(
			`DELETE FROM "audit_log" WHERE "action" = 'STOCK_ADJUSTED'`
		);
		await queryRunner.query(
			`ALTER TYPE "public"."audit_log_action_enum" RENAME TO "audit_log_action_enum_old"`
		);
		await queryRunner.query(
			`CREATE TYPE "public"."audit_log_action_enum" AS ENUM('ORDER_REFUNDED', 'ORDER_CANCELLED')`
		);
		await queryRunner.query(
			`ALTER TABLE "audit_log" ALTER COLUMN "action" TYPE "public"."audit_log_action_enum" USING "action"::text::"public"."audit_log_action_enum"`
		);
		await queryRunner.query(`DROP TYPE "public"."audit_log_action_enum_old"`);
	}
}
