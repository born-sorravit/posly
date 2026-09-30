import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * What a platform admin changed from the admin monitor. Kept apart from `audit_log`, which
 * belongs to a shop and names a shop member; an admin acts from outside every shop.
 */
export class AdminActionLog1790730000000 implements MigrationInterface {
	name = "AdminActionLog1790730000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`CREATE TABLE "admin_action_log" (
			"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
			"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
			"admin_user_id" uuid NOT NULL,
			"admin_email" character varying(255) NOT NULL,
			"action" character varying(40) NOT NULL,
			"target_type" character varying(20) NOT NULL,
			"target_id" uuid NOT NULL,
			"payload" jsonb NOT NULL DEFAULT '{}',
			CONSTRAINT "PK_admin_action_log" PRIMARY KEY ("id"))`);
		await queryRunner.query(
			`CREATE INDEX "idx_admin_action_log_created_at" ON "admin_action_log" ("created_at")`
		);
		await queryRunner.query(
			`CREATE INDEX "idx_admin_action_log_target" ON "admin_action_log" ("target_type", "target_id")`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "admin_action_log"`);
	}
}
