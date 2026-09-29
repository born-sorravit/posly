import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1790567776478 implements MigrationInterface {
	name = "InitialSchema1790567776478";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TYPE "public"."user_provider_enum" AS ENUM('PASSWORD', 'GOOGLE')`
		);
		await queryRunner.query(
			`CREATE TABLE "user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "email" character varying(255) NOT NULL, "password_hash" character varying(255), "provider" "public"."user_provider_enum" NOT NULL DEFAULT 'PASSWORD', "provider_id" character varying(255), "name" character varying(120) NOT NULL, "avatar_url" character varying(500), "is_verified" boolean NOT NULL DEFAULT false, "locale" character varying(5) NOT NULL DEFAULT 'th', CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_user_email" ON "user"  ("email") `
		);
		await queryRunner.query(
			`CREATE TABLE "refresh_token" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "token_hash" character varying(64) NOT NULL, "user_id" uuid NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "revoked_reason" character varying(16), "user_agent" character varying(255), CONSTRAINT "PK_b575dd3c21fb0831013c909e7fe" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_refresh_token_hash" ON "refresh_token"  ("token_hash") `
		);
		await queryRunner.query(
			`CREATE INDEX "idx_refresh_token_user_id" ON "refresh_token"  ("user_id") `
		);
		await queryRunner.query(
			`CREATE TYPE "public"."business_business_type_enum" AS ENUM('CAFE', 'RESTAURANT', 'BEVERAGE', 'BAKERY', 'RETAIL', 'SERVICE', 'OTHER')`
		);
		await queryRunner.query(
			`CREATE TABLE "business" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "name" character varying(120) NOT NULL, "business_type" "public"."business_business_type_enum" NOT NULL, "logo_path" character varying(300), "phone" character varying(30), "address" text, "tax_id" character varying(20), "promptpay_id" character varying(20), "currency" character(3) NOT NULL DEFAULT 'THB', "timezone" character varying(64) NOT NULL DEFAULT 'Asia/Bangkok', "vat_basis_points" integer NOT NULL DEFAULT '0', "prices_include_vat" boolean NOT NULL DEFAULT true, "onboarded_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_0bd850da8dafab992e2e9b058e5" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE TABLE "branch" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "business_id" uuid NOT NULL, "name" character varying(120) NOT NULL, "phone" character varying(30), "address" text, "is_default" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_2e39f426e2faefdaa93c5961976" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "idx_branch_business_id" ON "branch"  ("business_id") `
		);
		await queryRunner.query(
			`CREATE TYPE "public"."business_member_role_enum" AS ENUM('OWNER', 'MANAGER', 'CASHIER', 'STAFF')`
		);
		await queryRunner.query(
			`CREATE TYPE "public"."business_member_status_enum" AS ENUM('INVITED', 'ACTIVE', 'DISABLED')`
		);
		await queryRunner.query(
			`CREATE TABLE "business_member" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "business_id" uuid NOT NULL, "user_id" uuid, "email" character varying(255) NOT NULL, "display_name" character varying(120) NOT NULL, "role" "public"."business_member_role_enum" NOT NULL, "status" "public"."business_member_status_enum" NOT NULL DEFAULT 'ACTIVE', "permissions" jsonb, "branch_ids" uuid array, "pin_hash" character varying(255), CONSTRAINT "PK_9f500725518a9fada6fa339ada9" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "idx_business_member_business_id" ON "business_member"  ("business_id") `
		);
		await queryRunner.query(
			`CREATE INDEX "idx_business_member_user_id" ON "business_member"  ("user_id") `
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_business_member_email" ON "business_member"  ("business_id", "email") WHERE deleted_at IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_business_member_user" ON "business_member"  ("business_id", "user_id") WHERE user_id IS NOT NULL AND deleted_at IS NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "refresh_token" ADD CONSTRAINT "FK_6bbe63d2fe75e7f0ba1710351d4" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "branch" ADD CONSTRAINT "FK_1c7be7e41736e735835662ceacb" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "business_member" ADD CONSTRAINT "FK_78222886fab5f2ea32410989639" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "business_member" ADD CONSTRAINT "FK_5b1a7f38d3a58be120d72a1d224" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "business_member" DROP CONSTRAINT "FK_5b1a7f38d3a58be120d72a1d224"`
		);
		await queryRunner.query(
			`ALTER TABLE "business_member" DROP CONSTRAINT "FK_78222886fab5f2ea32410989639"`
		);
		await queryRunner.query(
			`ALTER TABLE "branch" DROP CONSTRAINT "FK_1c7be7e41736e735835662ceacb"`
		);
		await queryRunner.query(
			`ALTER TABLE "refresh_token" DROP CONSTRAINT "FK_6bbe63d2fe75e7f0ba1710351d4"`
		);
		await queryRunner.query(`DROP INDEX "public"."uq_business_member_user"`);
		await queryRunner.query(`DROP INDEX "public"."uq_business_member_email"`);
		await queryRunner.query(`DROP INDEX "public"."idx_business_member_user_id"`);
		await queryRunner.query(`DROP INDEX "public"."idx_business_member_business_id"`);
		await queryRunner.query(`DROP TABLE "business_member"`);
		await queryRunner.query(`DROP TYPE "public"."business_member_status_enum"`);
		await queryRunner.query(`DROP TYPE "public"."business_member_role_enum"`);
		await queryRunner.query(`DROP INDEX "public"."idx_branch_business_id"`);
		await queryRunner.query(`DROP TABLE "branch"`);
		await queryRunner.query(`DROP TABLE "business"`);
		await queryRunner.query(`DROP TYPE "public"."business_business_type_enum"`);
		await queryRunner.query(`DROP INDEX "public"."idx_refresh_token_user_id"`);
		await queryRunner.query(`DROP INDEX "public"."uq_refresh_token_hash"`);
		await queryRunner.query(`DROP TABLE "refresh_token"`);
		await queryRunner.query(`DROP INDEX "public"."uq_user_email"`);
		await queryRunner.query(`DROP TABLE "user"`);
		await queryRunner.query(`DROP TYPE "public"."user_provider_enum"`);
	}
}
