import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Recipes: ingredients with what they cost as bought, and the lines that say how much of
 * each a product or a modifier option uses. `order.ingredient_usage` records what a sale
 * took from stock so a refund can put exactly that back.
 */
export class Ingredients1790780000000 implements MigrationInterface {
	name = "Ingredients1790780000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`CREATE TABLE "ingredient" (
			"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
			"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
			"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
			"deleted_at" TIMESTAMP WITH TIME ZONE,
			"business_id" uuid NOT NULL,
			"name" character varying(80) NOT NULL,
			"unit" character varying(20) NOT NULL,
			"purchase_price" bigint NOT NULL DEFAULT 0,
			"purchase_qty" numeric(14,3) NOT NULL DEFAULT 1,
			"track_stock" boolean NOT NULL DEFAULT false,
			"stock" numeric(14,3),
			"low_stock_at" numeric(14,3),
			CONSTRAINT "PK_ingredient" PRIMARY KEY ("id"),
			CONSTRAINT "FK_ingredient_business" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE)`);
		await queryRunner.query(
			`CREATE INDEX "idx_ingredient_business_id" ON "ingredient" ("business_id")`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_ingredient_business_name" ON "ingredient" ("business_id", "name") WHERE "deleted_at" IS NULL`
		);

		await queryRunner.query(`CREATE TABLE "recipe_line" (
			"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
			"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
			"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
			"deleted_at" TIMESTAMP WITH TIME ZONE,
			"business_id" uuid NOT NULL,
			"product_id" uuid,
			"modifier_option_id" uuid,
			"ingredient_id" uuid NOT NULL,
			"quantity" numeric(14,3) NOT NULL,
			"display_order" integer NOT NULL DEFAULT 0,
			CONSTRAINT "PK_recipe_line" PRIMARY KEY ("id"),
			CONSTRAINT "chk_recipe_line_owner" CHECK (("product_id" IS NULL) <> ("modifier_option_id" IS NULL)),
			CONSTRAINT "FK_recipe_line_ingredient" FOREIGN KEY ("ingredient_id") REFERENCES "ingredient"("id") ON DELETE CASCADE,
			CONSTRAINT "FK_recipe_line_product" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE,
			CONSTRAINT "FK_recipe_line_modifier_option" FOREIGN KEY ("modifier_option_id") REFERENCES "modifier_option"("id") ON DELETE CASCADE)`);
		for (const column of [
			"business_id",
			"product_id",
			"modifier_option_id",
			"ingredient_id",
		]) {
			await queryRunner.query(
				`CREATE INDEX "idx_recipe_line_${column}" ON "recipe_line" ("${column}")`
			);
		}

		await queryRunner.query(`ALTER TABLE "order" ADD "ingredient_usage" jsonb`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "ingredient_usage"`);
		await queryRunner.query(`DROP TABLE "recipe_line"`);
		await queryRunner.query(`DROP TABLE "ingredient"`);
	}
}
