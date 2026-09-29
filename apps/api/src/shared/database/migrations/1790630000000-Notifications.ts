import { MigrationInterface, QueryRunner } from "typeorm";

export class Notifications1790630000000 implements MigrationInterface {
	name = "Notifications1790630000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TYPE "public"."notification_kind_enum" AS ENUM('LOW_STOCK', 'OUT_OF_STOCK', 'REFUND', 'CANCELLED', 'DAILY_SUMMARY', 'ORDER_QUOTA')`
		);
		await queryRunner.query(`CREATE TABLE "notification" (
			"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
			"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
			"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
			"deleted_at" TIMESTAMP WITH TIME ZONE,
			"business_id" uuid NOT NULL,
			"branch_id" uuid,
			"kind" "public"."notification_kind_enum" NOT NULL,
			"entity_id" uuid,
			"data" jsonb NOT NULL DEFAULT '{}',
			"dedupe_key" character varying(80),
			CONSTRAINT "PK_notification" PRIMARY KEY ("id"),
			CONSTRAINT "FK_notification_business" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE)`);
		await queryRunner.query(
			`CREATE INDEX "idx_notification_business_created" ON "notification" ("business_id", "created_at")`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_notification_dedupe" ON "notification" ("business_id", "dedupe_key") WHERE dedupe_key IS NOT NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "business_member" ADD "notifications_read_at" TIMESTAMP WITH TIME ZONE`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "business_member" DROP COLUMN "notifications_read_at"`
		);
		await queryRunner.query(`DROP TABLE "notification"`);
		await queryRunner.query(`DROP TYPE "public"."notification_kind_enum"`);
	}
}
