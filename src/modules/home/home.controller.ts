import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import { HomeService } from "./home.service";

@Controller("home")
export class HomeController {
    constructor(private readonly homeService: HomeService) {}

    @Get(":userId")
    async getHomeFeed(@Param("userId", ParseUUIDPipe) userId: string) {
        return this.homeService.getHomeFeed(userId);
    }
}
