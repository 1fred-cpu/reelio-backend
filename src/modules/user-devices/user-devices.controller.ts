import { Controller, Post, Body, Req, UseGuards } from "@nestjs/common";
import { UserDevicesService } from "./user-devices.service";

@Controller("devices")
export class UserDevicesController {
    constructor(private readonly devicesService: UserDevicesService) {}

    @Post("register")
    async register(
        @Body()
        dto: {
            userId: string;
            deviceToken: string;
            deviceType?: string;
        }
    ) {
        return this.devicesService.registerDevice(
            dto
        
        );
    }
}
