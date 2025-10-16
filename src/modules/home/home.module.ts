import { Module } from "@nestjs/common";
import { HomeService } from "./home.service";
import { HomeController } from "./home.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Content } from "@entities/content.entity";
import { User } from "@entities/user.entity";
import { WatchHistory } from "@entities/watch-history.entity";
@Module({
    imports: [TypeOrmModule.forFeature([Content, User, WatchHistory])],
    controllers: [HomeController],
    providers: [HomeService]
})
export class HomeModule {}
