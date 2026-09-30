import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Makes the cost figures honest:
 * - `modifier_option.cost_delta`: an extra shot costs something too, snapshotted on the sold
 *   option like its price delta.
 * - `order_item.cost_missing`: the product had no cost when sold, so its `unit_cost` of 0 is
 *   "unknown", not "free". Earlier rows cannot be told apart and stay false.
 * - `order_item.discount`: the line's share of the order discount, so per-product profit adds
 *   up to the order's. Earlier rows stay 0.
 */
export class CostAccuracy1790770000000 implements MigrationInterface {
	name = "CostAccuracy1790770000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "modifier_option" ADD "cost_delta" bigint NOT NULL DEFAULT 0`
		);
		await queryRunner.query(
			`ALTER TABLE "order_item_modifier" ADD "cost_delta" bigint NOT NULL DEFAULT 0`
		);
		await queryRunner.query(
			`ALTER TABLE "order_item" ADD "cost_missing" boolean NOT NULL DEFAULT false`
		);
		await queryRunner.query(
			`ALTER TABLE "order_item" ADD "discount" bigint NOT NULL DEFAULT 0`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "order_item" DROP COLUMN "discount"`);
		await queryRunner.query(`ALTER TABLE "order_item" DROP COLUMN "cost_missing"`);
		await queryRunner.query(
			`ALTER TABLE "order_item_modifier" DROP COLUMN "cost_delta"`
		);
		await queryRunner.query(
			`ALTER TABLE "modifier_option" DROP COLUMN "cost_delta"`
		);
	}
}
