import { MigrationInterface, QueryRunner } from "typeorm";

export class PinLogin1790680000000 implements MigrationInterface {
	name = "PinLogin1790680000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "business_member" ADD "pin_failed_attempts" integer NOT NULL DEFAULT 0`
		);
		await queryRunner.query(
			`ALTER TABLE "business_member" ADD "pin_locked_until" TIMESTAMP WITH TIME ZONE`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "business_member" DROP COLUMN "pin_locked_until"`
		);
		await queryRunner.query(
			`ALTER TABLE "business_member" DROP COLUMN "pin_failed_attempts"`
		);
	}
}
