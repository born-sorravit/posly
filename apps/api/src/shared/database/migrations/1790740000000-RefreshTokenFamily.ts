import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Groups refresh tokens by sign-in. Every token rotated from one login shares a family, so a
 * rotation can retire the siblings that concurrent refreshes created inside the reuse grace
 * window. Existing rows become one-token families of their own.
 */
export class RefreshTokenFamily1790740000000 implements MigrationInterface {
	name = "RefreshTokenFamily1790740000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "refresh_token" ADD "family_id" uuid`);
		await queryRunner.query(`UPDATE "refresh_token" SET "family_id" = "id"`);
		await queryRunner.query(
			`ALTER TABLE "refresh_token" ALTER COLUMN "family_id" SET NOT NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "refresh_token" ALTER COLUMN "family_id" SET DEFAULT uuid_generate_v4()`
		);
		await queryRunner.query(
			`CREATE INDEX "idx_refresh_token_family_active" ON "refresh_token" ("family_id") WHERE "revoked_at" IS NULL`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "idx_refresh_token_family_active"`);
		await queryRunner.query(`ALTER TABLE "refresh_token" DROP COLUMN "family_id"`);
	}
}
