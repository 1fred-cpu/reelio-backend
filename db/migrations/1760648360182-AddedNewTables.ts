import { MigrationInterface, QueryRunner } from "typeorm";

export class AddedNewTables1760648360182 implements MigrationInterface {
    name = 'AddedNewTables1760648360182'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "likes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" character varying NOT NULL, "content_id" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid, "contentId" uuid, CONSTRAINT "UQ_7adc27053c687cb11bde2e32766" UNIQUE ("user_id", "content_id"), CONSTRAINT "PK_a9323de3f8bced7539a794b4a37" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3f519ed95f775c781a25408917" ON "likes" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_ebee2fd0942b9a194cdf11d589" ON "likes" ("content_id") `);
        await queryRunner.query(`CREATE TABLE "views" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid, "content_id" uuid NOT NULL, "ip_address" character varying(255), "user_agent" character varying(255), "watch_duration_seconds" integer NOT NULL DEFAULT '0', "completed" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid, "contentId" uuid, CONSTRAINT "UQ_fed7bb5f630f90ffbcefb20166e" UNIQUE ("user_id", "content_id"), CONSTRAINT "PK_ae7537f375649a618fff0fb2cb6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5a616073aea982ac9a6c5eb40d" ON "views" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_32fc5c1f29fb2ccad779319eb1" ON "views" ("content_id") `);
        await queryRunner.query(`CREATE TYPE "public"."contents_type_enum" AS ENUM('short_film', 'feature_film', 'documentary', 'series', 'clip', 'other')`);
        await queryRunner.query(`CREATE TYPE "public"."contents_status_enum" AS ENUM('draft', 'published', 'private', 'archived')`);
        await queryRunner.query(`CREATE TABLE "contents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(255) NOT NULL, "description" text, "type" "public"."contents_type_enum" NOT NULL DEFAULT 'other', "status" "public"."contents_status_enum" NOT NULL DEFAULT 'draft', "thumbnail_url" character varying, "video_url" character varying, "trailer_url" character varying, "duration_seconds" integer NOT NULL DEFAULT '0', "creator_id" uuid NOT NULL, "views_count" integer NOT NULL DEFAULT '0', "likes_count" integer NOT NULL DEFAULT '0', "featured" boolean NOT NULL DEFAULT false, "featured_at" TIMESTAMP, "tags" character varying array NOT NULL DEFAULT '{}', "metadata" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "creatorId" uuid, CONSTRAINT "PK_b7c504072e537532d7080c54fac" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e6cd34fe183f1394730a55518c" ON "contents" ("views_count") `);
        await queryRunner.query(`CREATE INDEX "IDX_501d0b0097f75ecd0321b33d5a" ON "contents" ("likes_count") `);
        await queryRunner.query(`CREATE TABLE "follows" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "follower_id" character varying NOT NULL, "following_id" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "followerId" uuid, "followingId" uuid, CONSTRAINT "UQ_8109e59f691f0444b43420f6987" UNIQUE ("follower_id", "following_id"), CONSTRAINT "PK_8988f607744e16ff79da3b8a627" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_54b5dc2739f2dea57900933db6" ON "follows" ("follower_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_c518e3988b9c057920afaf2d8c" ON "follows" ("following_id") `);
        await queryRunner.query(`CREATE TABLE "watch_historys" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "content_id" uuid NOT NULL, "progress_seconds" integer NOT NULL DEFAULT '0', "duration_seconds" integer, "completed" boolean NOT NULL DEFAULT false, "last_watched_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid, "contentId" uuid, CONSTRAINT "UQ_a69d2baab1022205d4450f94444" UNIQUE ("user_id", "content_id"), CONSTRAINT "PK_2f90ad91b4a77e6a5e64ad15d90" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0f0bdda06529ed793061aab60e" ON "watch_historys" ("last_watched_at") `);
        await queryRunner.query(`ALTER TABLE "users" ADD "featured" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "likes" ADD CONSTRAINT "FK_cfd8e81fac09d7339a32e57d904" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "likes" ADD CONSTRAINT "FK_9050177b30cb3020f721d90d563" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "views" ADD CONSTRAINT "FK_1a136367d53567a43ba7aae5a7b" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "views" ADD CONSTRAINT "FK_fab5facf7f9c02dda0481a1e1b6" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "contents" ADD CONSTRAINT "FK_caa8a50d2c9b7e66a44e174f4f5" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "follows" ADD CONSTRAINT "FK_fdb91868b03a2040db408a53331" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "follows" ADD CONSTRAINT "FK_ef463dd9a2ce0d673350e36e0fb" FOREIGN KEY ("followingId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "watch_historys" ADD CONSTRAINT "FK_b4b0ab426a2964bc2e99f8501fe" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "watch_historys" ADD CONSTRAINT "FK_3ec7e2348fd1807776dec9526d7" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "watch_historys" DROP CONSTRAINT "FK_3ec7e2348fd1807776dec9526d7"`);
        await queryRunner.query(`ALTER TABLE "watch_historys" DROP CONSTRAINT "FK_b4b0ab426a2964bc2e99f8501fe"`);
        await queryRunner.query(`ALTER TABLE "follows" DROP CONSTRAINT "FK_ef463dd9a2ce0d673350e36e0fb"`);
        await queryRunner.query(`ALTER TABLE "follows" DROP CONSTRAINT "FK_fdb91868b03a2040db408a53331"`);
        await queryRunner.query(`ALTER TABLE "contents" DROP CONSTRAINT "FK_caa8a50d2c9b7e66a44e174f4f5"`);
        await queryRunner.query(`ALTER TABLE "views" DROP CONSTRAINT "FK_fab5facf7f9c02dda0481a1e1b6"`);
        await queryRunner.query(`ALTER TABLE "views" DROP CONSTRAINT "FK_1a136367d53567a43ba7aae5a7b"`);
        await queryRunner.query(`ALTER TABLE "likes" DROP CONSTRAINT "FK_9050177b30cb3020f721d90d563"`);
        await queryRunner.query(`ALTER TABLE "likes" DROP CONSTRAINT "FK_cfd8e81fac09d7339a32e57d904"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "featured"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0f0bdda06529ed793061aab60e"`);
        await queryRunner.query(`DROP TABLE "watch_historys"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c518e3988b9c057920afaf2d8c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_54b5dc2739f2dea57900933db6"`);
        await queryRunner.query(`DROP TABLE "follows"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_501d0b0097f75ecd0321b33d5a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e6cd34fe183f1394730a55518c"`);
        await queryRunner.query(`DROP TABLE "contents"`);
        await queryRunner.query(`DROP TYPE "public"."contents_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."contents_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_32fc5c1f29fb2ccad779319eb1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5a616073aea982ac9a6c5eb40d"`);
        await queryRunner.query(`DROP TABLE "views"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ebee2fd0942b9a194cdf11d589"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3f519ed95f775c781a25408917"`);
        await queryRunner.query(`DROP TABLE "likes"`);
    }

}
