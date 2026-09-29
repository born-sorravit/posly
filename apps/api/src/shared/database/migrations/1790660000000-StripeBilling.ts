import { MigrationInterface, QueryRunner } from "typeorm";

export class StripeBilling1790660000000 implements MigrationInterface {
	name = "StripeBilling1790660000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "subscription" ADD "stripe_customer_id" character varying(64)`
		);
		await queryRunner.query(
			`ALTER TABLE "subscription" ADD "stripe_subscription_id" character varying(64)`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_subscription_stripe_subscription" ON "subscription" ("stripe_subscription_id") WHERE stripe_subscription_id IS NOT NULL`
		);
		await queryRunner.query(
			`ALTER TYPE "public"."notification_kind_enum" ADD VALUE IF NOT EXISTS 'PAYMENT_FAILED'`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Postgres cannot drop an enum value; PAYMENT_FAILED stays, unused.
		await queryRunner.query(`DROP INDEX "uq_subscription_stripe_subscription"`);
		await queryRunner.query(
			`ALTER TABLE "subscription" DROP COLUMN "stripe_subscription_id"`
		);
		await queryRunner.query(
			`ALTER TABLE "subscription" DROP COLUMN "stripe_customer_id"`
		);
	}
}
