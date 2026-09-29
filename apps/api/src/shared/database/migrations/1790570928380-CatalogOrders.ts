import { MigrationInterface, QueryRunner } from "typeorm";

export class CatalogOrders1790570928380 implements MigrationInterface {
	name = "CatalogOrders1790570928380";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TYPE "public"."audit_log_action_enum" AS ENUM('ORDER_REFUNDED', 'ORDER_CANCELLED')`
		);
		await queryRunner.query(
			`CREATE TABLE "audit_log" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "business_id" uuid NOT NULL, "member_id" uuid NOT NULL, "actor_name" character varying(120) NOT NULL, "action" "public"."audit_log_action_enum" NOT NULL, "entity" character varying(40) NOT NULL, "entity_id" uuid NOT NULL, "payload" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "PK_07fefa57f7f5ab8fc3f52b3ed0b" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "idx_audit_log_entity" ON "audit_log"  ("business_id", "entity", "entity_id") `
		);
		await queryRunner.query(
			`CREATE TABLE "category" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "business_id" uuid NOT NULL, "name" character varying(80) NOT NULL, "icon" character varying(40) NOT NULL DEFAULT 'package', "display_order" integer NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_9c4e4a89e3674fc9f382d733f03" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "idx_category_business_order" ON "category"  ("business_id", "display_order") `
		);
		await queryRunner.query(
			`CREATE TABLE "modifier_option" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "group_id" uuid NOT NULL, "name" character varying(80) NOT NULL, "price_delta" bigint NOT NULL DEFAULT '0', "is_default" boolean NOT NULL DEFAULT false, "display_order" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_a973756efc5f49296945f6acfa5" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "idx_modifier_option_group_id" ON "modifier_option"  ("group_id") `
		);
		await queryRunner.query(
			`CREATE TYPE "public"."modifier_group_selection_enum" AS ENUM('SINGLE', 'MULTIPLE')`
		);
		await queryRunner.query(
			`CREATE TABLE "modifier_group" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "business_id" uuid NOT NULL, "name" character varying(80) NOT NULL, "selection" "public"."modifier_group_selection_enum" NOT NULL DEFAULT 'SINGLE', "required" boolean NOT NULL DEFAULT false, "display_order" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_bda4dae1e8b5e69941a9c26b363" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "idx_modifier_group_business_id" ON "modifier_group"  ("business_id") `
		);
		await queryRunner.query(
			`CREATE TABLE "product" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "business_id" uuid NOT NULL, "category_id" uuid, "name" character varying(120) NOT NULL, "price" bigint NOT NULL, "cost" bigint, "sku" character varying(40), "barcode" character varying(40), "image_path" character varying(300), "art" character varying(20) NOT NULL DEFAULT 'coffee', "track_stock" boolean NOT NULL DEFAULT false, "stock" integer, "low_stock_at" integer, "unit" character varying(20) NOT NULL DEFAULT 'ชิ้น', "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_bebc9158e480b949565b4dc7a82" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_product_business_sku" ON "product"  ("business_id", "sku") WHERE sku IS NOT NULL AND deleted_at IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "idx_product_business_category" ON "product"  ("business_id", "category_id") `
		);
		await queryRunner.query(
			`CREATE TYPE "public"."payment_method_enum" AS ENUM('CASH', 'PROMPTPAY', 'CARD', 'OTHER')`
		);
		await queryRunner.query(
			`CREATE TYPE "public"."payment_status_enum" AS ENUM('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED')`
		);
		await queryRunner.query(
			`CREATE TABLE "payment" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "business_id" uuid NOT NULL, "order_id" uuid NOT NULL, "method" "public"."payment_method_enum" NOT NULL, "status" "public"."payment_status_enum" NOT NULL, "amount" bigint NOT NULL, "received" bigint, "change_due" bigint, "reference" character varying(120), CONSTRAINT "PK_fcaec7df5adf9cac408c686b2ab" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "idx_payment_order_id" ON "payment"  ("order_id") `
		);
		await queryRunner.query(
			`CREATE INDEX "idx_payment_business_created" ON "payment"  ("business_id", "created_at") `
		);
		await queryRunner.query(
			`CREATE TYPE "public"."order_status_enum" AS ENUM('DRAFT', 'PENDING_PAYMENT', 'PAID', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED')`
		);
		await queryRunner.query(
			`CREATE TABLE "order" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "business_id" uuid NOT NULL, "branch_id" uuid NOT NULL, "member_id" uuid NOT NULL, "employee_name" character varying(120) NOT NULL, "number" integer NOT NULL, "client_order_id" uuid NOT NULL, "status" "public"."order_status_enum" NOT NULL, "subtotal" bigint NOT NULL, "discount" bigint NOT NULL DEFAULT '0', "vat" bigint NOT NULL DEFAULT '0', "total" bigint NOT NULL, "total_cost" bigint NOT NULL DEFAULT '0', "vat_basis_points" integer NOT NULL DEFAULT '0', "prices_include_vat" boolean NOT NULL DEFAULT true, "paid_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_1031171c13130102495201e3e20" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "idx_order_member_id" ON "order"  ("member_id") `
		);
		await queryRunner.query(
			`CREATE INDEX "idx_order_business_created" ON "order"  ("business_id", "created_at") `
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_order_business_client_id" ON "order"  ("business_id", "client_order_id") `
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_order_business_number" ON "order"  ("business_id", "number") `
		);
		await queryRunner.query(
			`CREATE TABLE "order_item" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "order_id" uuid NOT NULL, "product_id" uuid, "name" character varying(120) NOT NULL, "art" character varying(20) NOT NULL DEFAULT 'coffee', "quantity" integer NOT NULL, "unit_price" bigint NOT NULL, "unit_cost" bigint NOT NULL DEFAULT '0', "line_total" bigint NOT NULL, "note" character varying(200), CONSTRAINT "PK_d01158fe15b1ead5c26fd7f4e90" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "idx_order_item_order_id" ON "order_item"  ("order_id") `
		);
		await queryRunner.query(
			`CREATE INDEX "idx_order_item_product_id" ON "order_item"  ("product_id") `
		);
		await queryRunner.query(
			`CREATE TABLE "order_item_modifier" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "order_item_id" uuid NOT NULL, "option_id" uuid, "group_name" character varying(80) NOT NULL, "option_name" character varying(80) NOT NULL, "price_delta" bigint NOT NULL DEFAULT '0', CONSTRAINT "PK_0f4b322412d39d1e1627652a575" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "idx_order_item_modifier_item_id" ON "order_item_modifier"  ("order_item_id") `
		);
		await queryRunner.query(
			`CREATE TABLE "product_modifier_group" ("product_id" uuid NOT NULL, "modifier_group_id" uuid NOT NULL, CONSTRAINT "PK_37bc0163dbdbccfc385cf524d57" PRIMARY KEY ("product_id", "modifier_group_id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e35ee74f60bf7607fcfa5b5a44" ON "product_modifier_group"  ("product_id") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5b42ef2ec32ad54c8df5de8833" ON "product_modifier_group"  ("modifier_group_id") `
		);
		await queryRunner.query(
			`ALTER TABLE "business" ADD "order_seq" integer NOT NULL DEFAULT '0'`
		);
		await queryRunner.query(
			`ALTER TABLE "modifier_option" ADD CONSTRAINT "FK_6bf8fe320f247aef32c30defd2f" FOREIGN KEY ("group_id") REFERENCES "modifier_group"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product" ADD CONSTRAINT "FK_0dce9bc93c2d2c399982d04bef1" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "payment" ADD CONSTRAINT "FK_f5221735ace059250daac9d9803" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "order_item" ADD CONSTRAINT "FK_e9674a6053adbaa1057848cddfa" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "order_item_modifier" ADD CONSTRAINT "FK_aac3051564bae9386eb3748543d" FOREIGN KEY ("order_item_id") REFERENCES "order_item"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_modifier_group" ADD CONSTRAINT "FK_e35ee74f60bf7607fcfa5b5a44e" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "product_modifier_group" ADD CONSTRAINT "FK_5b42ef2ec32ad54c8df5de88337" FOREIGN KEY ("modifier_group_id") REFERENCES "modifier_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "product_modifier_group" DROP CONSTRAINT "FK_5b42ef2ec32ad54c8df5de88337"`
		);
		await queryRunner.query(
			`ALTER TABLE "product_modifier_group" DROP CONSTRAINT "FK_e35ee74f60bf7607fcfa5b5a44e"`
		);
		await queryRunner.query(
			`ALTER TABLE "order_item_modifier" DROP CONSTRAINT "FK_aac3051564bae9386eb3748543d"`
		);
		await queryRunner.query(
			`ALTER TABLE "order_item" DROP CONSTRAINT "FK_e9674a6053adbaa1057848cddfa"`
		);
		await queryRunner.query(
			`ALTER TABLE "payment" DROP CONSTRAINT "FK_f5221735ace059250daac9d9803"`
		);
		await queryRunner.query(
			`ALTER TABLE "product" DROP CONSTRAINT "FK_0dce9bc93c2d2c399982d04bef1"`
		);
		await queryRunner.query(
			`ALTER TABLE "modifier_option" DROP CONSTRAINT "FK_6bf8fe320f247aef32c30defd2f"`
		);
		await queryRunner.query(`ALTER TABLE "business" DROP COLUMN "order_seq"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_5b42ef2ec32ad54c8df5de8833"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e35ee74f60bf7607fcfa5b5a44"`);
		await queryRunner.query(`DROP TABLE "product_modifier_group"`);
		await queryRunner.query(`DROP INDEX "public"."idx_order_item_modifier_item_id"`);
		await queryRunner.query(`DROP TABLE "order_item_modifier"`);
		await queryRunner.query(`DROP INDEX "public"."idx_order_item_product_id"`);
		await queryRunner.query(`DROP INDEX "public"."idx_order_item_order_id"`);
		await queryRunner.query(`DROP TABLE "order_item"`);
		await queryRunner.query(`DROP INDEX "public"."uq_order_business_number"`);
		await queryRunner.query(`DROP INDEX "public"."uq_order_business_client_id"`);
		await queryRunner.query(`DROP INDEX "public"."idx_order_business_created"`);
		await queryRunner.query(`DROP INDEX "public"."idx_order_member_id"`);
		await queryRunner.query(`DROP TABLE "order"`);
		await queryRunner.query(`DROP TYPE "public"."order_status_enum"`);
		await queryRunner.query(`DROP INDEX "public"."idx_payment_business_created"`);
		await queryRunner.query(`DROP INDEX "public"."idx_payment_order_id"`);
		await queryRunner.query(`DROP TABLE "payment"`);
		await queryRunner.query(`DROP TYPE "public"."payment_status_enum"`);
		await queryRunner.query(`DROP TYPE "public"."payment_method_enum"`);
		await queryRunner.query(`DROP INDEX "public"."idx_product_business_category"`);
		await queryRunner.query(`DROP INDEX "public"."uq_product_business_sku"`);
		await queryRunner.query(`DROP TABLE "product"`);
		await queryRunner.query(`DROP INDEX "public"."idx_modifier_group_business_id"`);
		await queryRunner.query(`DROP TABLE "modifier_group"`);
		await queryRunner.query(`DROP TYPE "public"."modifier_group_selection_enum"`);
		await queryRunner.query(`DROP INDEX "public"."idx_modifier_option_group_id"`);
		await queryRunner.query(`DROP TABLE "modifier_option"`);
		await queryRunner.query(`DROP INDEX "public"."idx_category_business_order"`);
		await queryRunner.query(`DROP TABLE "category"`);
		await queryRunner.query(`DROP INDEX "public"."idx_audit_log_entity"`);
		await queryRunner.query(`DROP TABLE "audit_log"`);
		await queryRunner.query(`DROP TYPE "public"."audit_log_action_enum"`);
	}
}
