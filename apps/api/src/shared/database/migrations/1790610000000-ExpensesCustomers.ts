import { MigrationInterface, QueryRunner } from "typeorm";

/** Expenses (plan §19), customers (plan §22) and the customer on an order. */
export class ExpensesCustomers1790610000000 implements MigrationInterface {
	name = "ExpensesCustomers1790610000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TYPE "public"."expense_category_enum" AS ENUM('INGREDIENTS', 'UTILITIES', 'SALARY', 'RENT', 'EQUIPMENT', 'OTHER')`
		);
		await queryRunner.query(`CREATE TABLE "expense" (
			"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
			"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
			"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
			"deleted_at" TIMESTAMP WITH TIME ZONE,
			"business_id" uuid NOT NULL,
			"category" "public"."expense_category_enum" NOT NULL,
			"amount" bigint NOT NULL,
			"note" character varying(200),
			"spent_on" date NOT NULL,
			"member_id" uuid NOT NULL,
			"recorded_by" character varying(120) NOT NULL,
			CONSTRAINT "PK_expense" PRIMARY KEY ("id"),
			CONSTRAINT "FK_expense_business" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE)`);
		await queryRunner.query(
			`CREATE INDEX "idx_expense_business_spent_on" ON "expense" ("business_id", "spent_on")`
		);

		await queryRunner.query(`CREATE TABLE "customer" (
			"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
			"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
			"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
			"deleted_at" TIMESTAMP WITH TIME ZONE,
			"business_id" uuid NOT NULL,
			"name" character varying(120) NOT NULL,
			"phone" character varying(20),
			"email" character varying(255),
			"note" character varying(300),
			CONSTRAINT "PK_customer" PRIMARY KEY ("id"),
			CONSTRAINT "FK_customer_business" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE)`);
		await queryRunner.query(
			`CREATE INDEX "idx_customer_business_id" ON "customer" ("business_id")`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_customer_phone" ON "customer" ("business_id", "phone") WHERE phone IS NOT NULL AND deleted_at IS NULL`
		);

		await queryRunner.query(`ALTER TABLE "order" ADD "customer_id" uuid`);
		await queryRunner.query(
			`ALTER TABLE "order" ADD "customer_name" character varying(120)`
		);
		await queryRunner.query(
			`CREATE INDEX "idx_order_customer_id" ON "order" ("customer_id")`
		);
		await queryRunner.query(
			`ALTER TABLE "order" ADD CONSTRAINT "FK_order_customer" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE SET NULL`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "order" DROP CONSTRAINT "FK_order_customer"`
		);
		await queryRunner.query(`DROP INDEX "public"."idx_order_customer_id"`);
		await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "customer_name"`);
		await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "customer_id"`);
		await queryRunner.query(`DROP TABLE "customer"`);
		await queryRunner.query(`DROP TABLE "expense"`);
		await queryRunner.query(`DROP TYPE "public"."expense_category_enum"`);
	}
}
