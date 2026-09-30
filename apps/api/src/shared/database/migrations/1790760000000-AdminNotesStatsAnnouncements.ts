import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Three admin-monitor additions:
 * - `admin_note`: the support team's notes on a shop or an account.
 * - `platform_daily_stat`: one snapshot a day of the figures that have no history of their
 *   own (MRR, paid shops), so growth can be charted from now on.
 * - `ANNOUNCEMENT`: a notification kind for messages Posly sends to shops.
 */
export class AdminNotesStatsAnnouncements1790760000000
	implements MigrationInterface
{
	name = "AdminNotesStatsAnnouncements1790760000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`CREATE TABLE "admin_note" (
			"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
			"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
			"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
			"deleted_at" TIMESTAMP WITH TIME ZONE,
			"admin_user_id" uuid NOT NULL,
			"admin_email" character varying(255) NOT NULL,
			"target_type" character varying(20) NOT NULL,
			"target_id" uuid NOT NULL,
			"body" text NOT NULL,
			CONSTRAINT "PK_admin_note" PRIMARY KEY ("id"))`);
		await queryRunner.query(
			`CREATE INDEX "idx_admin_note_target" ON "admin_note" ("target_type", "target_id") WHERE "deleted_at" IS NULL`
		);

		await queryRunner.query(`CREATE TABLE "platform_daily_stat" (
			"day" date NOT NULL,
			"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
			"mrr" bigint NOT NULL,
			"paid_businesses" integer NOT NULL,
			"businesses" integer NOT NULL,
			"users" integer NOT NULL,
			CONSTRAINT "PK_platform_daily_stat" PRIMARY KEY ("day"))`);

		await queryRunner.query(
			`ALTER TYPE "public"."notification_kind_enum" ADD VALUE IF NOT EXISTS 'ANNOUNCEMENT'`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "platform_daily_stat"`);
		await queryRunner.query(`DROP TABLE "admin_note"`);
		// Postgres cannot drop an enum value; ANNOUNCEMENT stays, unused.
	}
}
