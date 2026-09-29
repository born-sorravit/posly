import { MigrationInterface, QueryRunner } from "typeorm";

export class PasswordReset1790620000000 implements MigrationInterface {
	name = "PasswordReset1790620000000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`CREATE TABLE "password_reset" (
			"id" uuid NOT NULL DEFAULT uuid_generate_v4(),
			"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
			"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
			"deleted_at" TIMESTAMP WITH TIME ZONE,
			"user_id" uuid NOT NULL,
			"token_hash" character varying(64) NOT NULL,
			"expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
			"used_at" TIMESTAMP WITH TIME ZONE,
			CONSTRAINT "PK_password_reset" PRIMARY KEY ("id"),
			CONSTRAINT "FK_password_reset_user" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE)`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_password_reset_token" ON "password_reset" ("token_hash")`
		);
		await queryRunner.query(
			`CREATE INDEX "idx_password_reset_user_id" ON "password_reset" ("user_id")`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "password_reset"`);
	}
}
