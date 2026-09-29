import { MigrationInterface, QueryRunner } from "typeorm";

export class NotificationPreferences1790650000000 implements MigrationInterface {
	name = "NotificationPreferences1790650000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "business_member" ADD "muted_notifications" jsonb NOT NULL DEFAULT '[]'`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "business_member" DROP COLUMN "muted_notifications"`
		);
	}
}
