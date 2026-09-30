import { MigrationInterface, QueryRunner } from "typeorm";

export class PlatformAdmin1790720000000 implements MigrationInterface {
	name = "PlatformAdmin1790720000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "user" ADD "is_platform_admin" boolean NOT NULL DEFAULT false`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "is_platform_admin"`);
	}
}
