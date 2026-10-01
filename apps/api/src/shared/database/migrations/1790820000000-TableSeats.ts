import { MigrationInterface, QueryRunner } from "typeorm";

/** How many a table seats, so staff can put a party at a table that fits. Optional. */
export class TableSeats1790820000000 implements MigrationInterface {
	name = "TableSeats1790820000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "dining_table" ADD "seats" integer`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "dining_table" DROP COLUMN "seats"`);
	}
}
