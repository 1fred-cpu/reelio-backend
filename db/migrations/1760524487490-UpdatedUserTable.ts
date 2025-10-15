import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdatedUserTable1760524487490 implements MigrationInterface {
    name = 'UpdatedUserTable1760524487490'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "email_confirmed_at" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email_confirmed_at"`);
    }

}
