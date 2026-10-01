import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Tables and QR ordering: a shop's tables, the tab a table has open, and what guests send
 * from the QR on the table before staff accept it into that tab's order.
 */
export class Tables1790790000000 implements MigrationInterface {
	name = "Tables1790790000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`CREATE TABLE "dining_table" (
			"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
			"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
			"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
			"deleted_at" TIMESTAMP WITH TIME ZONE,
			"business_id" uuid NOT NULL,
			"branch_id" uuid NOT NULL,
			"name" character varying(40) NOT NULL,
			"zone" character varying(40),
			"display_order" integer NOT NULL DEFAULT 0,
			"is_active" boolean NOT NULL DEFAULT true,
			"qr_token" character varying(64) NOT NULL,
			CONSTRAINT "PK_dining_table" PRIMARY KEY ("id"),
			CONSTRAINT "FK_dining_table_business" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE,
			CONSTRAINT "FK_dining_table_branch" FOREIGN KEY ("branch_id") REFERENCES "branch"("id") ON DELETE CASCADE)`);
		await queryRunner.query(
			`CREATE INDEX "idx_dining_table_business_branch" ON "dining_table" ("business_id", "branch_id")`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_dining_table_qr_token" ON "dining_table" ("qr_token")`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_dining_table_name" ON "dining_table" ("branch_id", "name") WHERE deleted_at IS NULL`
		);

		await queryRunner.query(
			`CREATE TYPE "public"."table_session_status_enum" AS ENUM('OPEN', 'CLOSED', 'CANCELLED')`
		);
		await queryRunner.query(`CREATE TABLE "table_session" (
			"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
			"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
			"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
			"deleted_at" TIMESTAMP WITH TIME ZONE,
			"business_id" uuid NOT NULL,
			"branch_id" uuid NOT NULL,
			"table_id" uuid NOT NULL,
			"status" "public"."table_session_status_enum" NOT NULL DEFAULT 'OPEN',
			"guests" integer,
			"opened_by_member_id" uuid NOT NULL,
			"opened_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
			"closed_at" TIMESTAMP WITH TIME ZONE,
			"order_id" uuid,
			CONSTRAINT "PK_table_session" PRIMARY KEY ("id"),
			CONSTRAINT "FK_table_session_business" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE,
			CONSTRAINT "FK_table_session_table" FOREIGN KEY ("table_id") REFERENCES "dining_table"("id") ON DELETE CASCADE,
			CONSTRAINT "FK_table_session_order" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE SET NULL)`);
		// One open tab per table: two staff opening the same table at once, one wins.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_table_session_open" ON "table_session" ("table_id") WHERE status = 'OPEN'`
		);
		await queryRunner.query(
			`CREATE INDEX "idx_table_session_business_status" ON "table_session" ("business_id", "status")`
		);

		await queryRunner.query(
			`CREATE TYPE "public"."table_request_status_enum" AS ENUM('PENDING', 'ACCEPTED', 'REJECTED')`
		);
		await queryRunner.query(`CREATE TABLE "table_request" (
			"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
			"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
			"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
			"deleted_at" TIMESTAMP WITH TIME ZONE,
			"business_id" uuid NOT NULL,
			"branch_id" uuid NOT NULL,
			"session_id" uuid NOT NULL,
			"client_request_id" uuid NOT NULL,
			"items" jsonb NOT NULL,
			"status" "public"."table_request_status_enum" NOT NULL DEFAULT 'PENDING',
			"handled_by_member_id" uuid,
			"handled_at" TIMESTAMP WITH TIME ZONE,
			CONSTRAINT "PK_table_request" PRIMARY KEY ("id"),
			CONSTRAINT "FK_table_request_business" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE,
			CONSTRAINT "FK_table_request_session" FOREIGN KEY ("session_id") REFERENCES "table_session"("id") ON DELETE CASCADE)`);
		// A guest's double-tap sends the same id twice; the second returns the first.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_table_request_client_id" ON "table_request" ("session_id", "client_request_id")`
		);
		await queryRunner.query(
			`CREATE INDEX "idx_table_request_session_status" ON "table_request" ("session_id", "status")`
		);

		await queryRunner.query(`ALTER TABLE "order" ADD "table_session_id" uuid`);
		await queryRunner.query(
			`CREATE INDEX "idx_order_table_session_id" ON "order" ("table_session_id")`
		);
		await queryRunner.query(
			`ALTER TABLE "order_item" ADD "round" integer NOT NULL DEFAULT 1`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "order_item" DROP COLUMN "round"`);
		await queryRunner.query(`DROP INDEX "public"."idx_order_table_session_id"`);
		await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "table_session_id"`);
		await queryRunner.query(`DROP TABLE "table_request"`);
		await queryRunner.query(`DROP TYPE "public"."table_request_status_enum"`);
		await queryRunner.query(`DROP TABLE "table_session"`);
		await queryRunner.query(`DROP TYPE "public"."table_session_status_enum"`);
		await queryRunner.query(`DROP TABLE "dining_table"`);
	}
}
