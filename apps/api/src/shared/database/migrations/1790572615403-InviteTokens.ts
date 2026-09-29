import { MigrationInterface, QueryRunner } from "typeorm";

export class InviteTokens1790572615403 implements MigrationInterface {
	name = "InviteTokens1790572615403";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "business_member" ADD "invite_token_hash" character varying(64)`
		);
		await queryRunner.query(
			`ALTER TABLE "business_member" ADD "invite_expires_at" TIMESTAMP WITH TIME ZONE`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_business_member_invite_token" ON "business_member"  ("invite_token_hash") WHERE invite_token_hash IS NOT NULL`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "public"."uq_business_member_invite_token"`);
		await queryRunner.query(
			`ALTER TABLE "business_member" DROP COLUMN "invite_expires_at"`
		);
		await queryRunner.query(
			`ALTER TABLE "business_member" DROP COLUMN "invite_token_hash"`
		);
	}
}
