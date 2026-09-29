import { MigrationInterface, QueryRunner } from "typeorm";

export class HiddenFromSwitch1790710000000 implements MigrationInterface {
	name = "HiddenFromSwitch1790710000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "business_member" ADD "hidden_from_switch" boolean NOT NULL DEFAULT false`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "business_member" DROP COLUMN "hidden_from_switch"`
		);
	}
}
