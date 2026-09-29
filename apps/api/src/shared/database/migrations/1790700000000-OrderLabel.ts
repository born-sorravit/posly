import { MigrationInterface, QueryRunner } from "typeorm";

export class OrderLabel1790700000000 implements MigrationInterface {
	name = "OrderLabel1790700000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TYPE "public"."order_service_type_enum" AS ENUM('DINE_IN', 'TAKEAWAY', 'DELIVERY')`
		);
		await queryRunner.query(
			`ALTER TABLE "order" ADD "service_type" "public"."order_service_type_enum"`
		);
		await queryRunner.query(`ALTER TABLE "order" ADD "label" character varying(40)`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "label"`);
		await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "service_type"`);
		await queryRunner.query(`DROP TYPE "public"."order_service_type_enum"`);
	}
}
