import { MigrationInterface, QueryRunner } from "typeorm";

export class ReceiptSettings1790590000000 implements MigrationInterface {
	name = "ReceiptSettings1790590000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "business" ADD "receipt_footer" character varying(300)`
		);
		await queryRunner.query(
			`ALTER TABLE "business" ADD "receipt_show_logo" boolean NOT NULL DEFAULT true`
		);
		await queryRunner.query(
			`ALTER TABLE "business" ADD "receipt_show_tax_id" boolean NOT NULL DEFAULT true`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "business" DROP COLUMN "receipt_show_tax_id"`
		);
		await queryRunner.query(
			`ALTER TABLE "business" DROP COLUMN "receipt_show_logo"`
		);
		await queryRunner.query(`ALTER TABLE "business" DROP COLUMN "receipt_footer"`);
	}
}
