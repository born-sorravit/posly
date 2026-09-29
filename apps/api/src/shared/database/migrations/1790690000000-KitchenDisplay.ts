import { MigrationInterface, QueryRunner } from "typeorm";

export class KitchenDisplay1790690000000 implements MigrationInterface {
	name = "KitchenDisplay1790690000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TYPE "public"."order_kitchen_status_enum" AS ENUM('NEW', 'PREPARING', 'READY', 'SERVED')`
		);
		await queryRunner.query(
			`ALTER TABLE "order" ADD "kitchen_status" "public"."order_kitchen_status_enum"`
		);
		await queryRunner.query(
			`ALTER TABLE "order" ADD "kitchen_updated_at" TIMESTAMP WITH TIME ZONE`
		);
		// The kitchen screen reads only open tickets; keep that read off the full order table.
		await queryRunner.query(
			`CREATE INDEX "idx_order_kitchen_open" ON "order" ("business_id", "created_at") WHERE kitchen_status IN ('NEW', 'PREPARING', 'READY')`
		);
		await queryRunner.query(
			`ALTER TABLE "order_item" ADD "to_kitchen" boolean NOT NULL DEFAULT false`
		);
		await queryRunner.query(
			`ALTER TABLE "order_item" ADD "prepared_at" TIMESTAMP WITH TIME ZONE`
		);
		await queryRunner.query(
			`ALTER TABLE "category" ADD "send_to_kitchen" boolean NOT NULL DEFAULT true`
		);
		// Kitchen Display ships: the Business card stops calling it "coming soon".
		await queryRunner.query(
			`UPDATE "subscription_plan" p SET "highlights" = (
				SELECT jsonb_agg(
					CASE WHEN h.value ->> 'label' = 'Kitchen Display' THEN jsonb_set(h.value, '{soon}', 'false'::jsonb) ELSE h.value END
					ORDER BY h.ord)
				FROM jsonb_array_elements(p.highlights) WITH ORDINALITY AS h(value, ord))
			WHERE p.highlights @> '[{"label": "Kitchen Display"}]'`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "category" DROP COLUMN "send_to_kitchen"`);
		await queryRunner.query(`ALTER TABLE "order_item" DROP COLUMN "prepared_at"`);
		await queryRunner.query(`ALTER TABLE "order_item" DROP COLUMN "to_kitchen"`);
		await queryRunner.query(`DROP INDEX "idx_order_kitchen_open"`);
		await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "kitchen_updated_at"`);
		await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "kitchen_status"`);
		await queryRunner.query(`DROP TYPE "public"."order_kitchen_status_enum"`);
	}
}
