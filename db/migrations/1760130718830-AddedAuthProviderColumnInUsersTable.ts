import { MigrationInterface, QueryRunner } from "typeorm";

export class AddedAuthProviderColumnInUsersTable1760130718830 implements MigrationInterface {
    name = 'AddedAuthProviderColumnInUsersTable1760130718830'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "users_auth_id_fkey"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "auth_provider" text NOT NULL DEFAULT 'email'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "auth_provider"`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "users_auth_id_fkey" FOREIGN KEY ("auth_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
