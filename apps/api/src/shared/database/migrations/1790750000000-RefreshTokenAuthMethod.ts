import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * How a sign-in was proven (password, google, pin, demo), carried by every token rotated from
 * it, so a route can ask for a stronger one — the admin monitor requires Google. Existing
 * rows are assumed from the account's provider, the best guess left after the fact.
 */
export class RefreshTokenAuthMethod1790750000000 implements MigrationInterface {
	name = "RefreshTokenAuthMethod1790750000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "refresh_token" ADD "auth_method" character varying(16) NOT NULL DEFAULT 'password'`
		);
		await queryRunner.query(
			`UPDATE "refresh_token" r SET "auth_method" = 'google'
			FROM "user" u WHERE u.id = r.user_id AND u.provider = 'GOOGLE'`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "refresh_token" DROP COLUMN "auth_method"`);
	}
}
