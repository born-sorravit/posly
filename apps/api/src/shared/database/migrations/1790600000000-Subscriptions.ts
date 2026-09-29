import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Plans, their features and each shop's subscription (plan §25–26).
 *
 * Seeds the four plans from the plan document. Prices and limits are placeholders the plan
 * expects to change — they are rows, edited without a release.
 *
 * Backfill: every existing business gets PRO, open-ended — what the app showed them until
 * now (the UI read a mock PRO subscription), so nothing they use today disappears. A shop
 * that already runs more than one branch gets BUSINESS, the only plan that allows it.
 * New businesses start on FREE (BusinessesService.create).
 */
export class Subscriptions1790600000000 implements MigrationInterface {
	name = "Subscriptions1790600000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TYPE "public"."subscription_status_enum" AS ENUM('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED')`
		);
		await queryRunner.query(`CREATE TABLE "subscription_plan" (
			"code" character varying(20) NOT NULL,
			"name" character varying(60) NOT NULL,
			"monthly_price" bigint NOT NULL,
			"order_limit" integer,
			"member_limit" integer,
			"branch_limit" integer,
			"highlights" jsonb NOT NULL DEFAULT '[]',
			"display_order" integer NOT NULL DEFAULT 0,
			"is_public" boolean NOT NULL DEFAULT true,
			"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
			"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
			CONSTRAINT "PK_subscription_plan" PRIMARY KEY ("code"))`);
		await queryRunner.query(`CREATE TABLE "plan_feature" (
			"plan_code" character varying(20) NOT NULL,
			"feature" character varying(40) NOT NULL,
			"enabled" boolean NOT NULL DEFAULT true,
			CONSTRAINT "PK_plan_feature" PRIMARY KEY ("plan_code", "feature"),
			CONSTRAINT "FK_plan_feature_plan" FOREIGN KEY ("plan_code") REFERENCES "subscription_plan"("code") ON DELETE CASCADE)`);
		await queryRunner.query(`CREATE TABLE "subscription" (
			"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
			"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
			"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
			"deleted_at" TIMESTAMP WITH TIME ZONE,
			"business_id" uuid NOT NULL,
			"plan_code" character varying(20) NOT NULL,
			"status" "public"."subscription_status_enum" NOT NULL DEFAULT 'ACTIVE',
			"start_date" TIMESTAMP WITH TIME ZONE NOT NULL,
			"end_date" TIMESTAMP WITH TIME ZONE,
			"cancel_at_period_end" boolean NOT NULL DEFAULT false,
			CONSTRAINT "PK_subscription" PRIMARY KEY ("id"),
			CONSTRAINT "FK_subscription_business" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE,
			CONSTRAINT "FK_subscription_plan" FOREIGN KEY ("plan_code") REFERENCES "subscription_plan"("code"))`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_subscription_business" ON "subscription" ("business_id") WHERE deleted_at IS NULL`
		);

		const plans: [
			string,
			string,
			number,
			number | null,
			number | null,
			number | null,
			string[],
			number,
		][] = [
			[
				"FREE",
				"Free",
				0,
				100,
				1,
				1,
				["100 ออเดอร์ / เดือน", "พนักงาน 1 คน", "แดชบอร์ดพื้นฐาน"],
				0,
			],
			[
				"STARTER",
				"Starter",
				9900,
				null,
				3,
				1,
				["ออเดอร์ไม่จำกัด", "พนักงาน 3 คน", "รายงานยอดขาย", "PromptPay", "ใบเสร็จ"],
				1,
			],
			[
				"PRO",
				"Pro",
				19_900,
				null,
				10,
				1,
				[
					"ออเดอร์ไม่จำกัด",
					"พนักงาน 10 คน",
					"สต๊อกสินค้า",
					"ค่าใช้จ่าย",
					"รายงานขั้นสูง",
					"ลูกค้า",
					"แจ้งเตือน LINE",
				],
				2,
			],
			[
				"BUSINESS",
				"Business",
				39_900,
				null,
				null,
				null,
				[
					"ทุกอย่างใน Pro",
					"หลายสาขา",
					"พนักงานไม่จำกัด",
					"Kitchen Display",
					"สิทธิ์ขั้นสูง",
					"ซัพพอร์ตก่อนใคร",
				],
				3,
			],
		];
		for (const [
			code,
			name,
			price,
			orders,
			members,
			branches,
			highlights,
			order,
		] of plans) {
			await queryRunner.query(
				`INSERT INTO "subscription_plan" ("code", "name", "monthly_price", "order_limit", "member_limit", "branch_limit", "highlights", "display_order")
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
				[
					code,
					name,
					price,
					orders,
					members,
					branches,
					JSON.stringify(highlights),
					order,
				]
			);
		}

		const pro = [
			"INVENTORY",
			"EXPENSES",
			"ADVANCED_REPORT",
			"CUSTOMERS",
			"LINE_NOTIFICATION",
		];
		const business = [
			...pro,
			"MULTI_BRANCH",
			"KITCHEN_DISPLAY",
			"ADVANCED_PERMISSION",
		];
		for (const [plan, features] of [
			["PRO", pro],
			["BUSINESS", business],
		] as const) {
			for (const feature of features) {
				await queryRunner.query(
					`INSERT INTO "plan_feature" ("plan_code", "feature") VALUES ($1, $2)`,
					[plan, feature]
				);
			}
		}

		await queryRunner.query(
			`INSERT INTO "subscription" ("business_id", "plan_code", "status", "start_date")
			 SELECT b."id",
			        CASE WHEN (SELECT COUNT(*) FROM "branch" br WHERE br."business_id" = b."id" AND br."deleted_at" IS NULL) > 1
			             THEN 'BUSINESS' ELSE 'PRO' END,
			        'ACTIVE', now()
			 FROM "business" b WHERE b."deleted_at" IS NULL`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "subscription"`);
		await queryRunner.query(`DROP TABLE "plan_feature"`);
		await queryRunner.query(`DROP TABLE "subscription_plan"`);
		await queryRunner.query(`DROP TYPE "public"."subscription_status_enum"`);
	}
}
