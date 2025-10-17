import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserDevice } from "@entities/user-device.entity";

@Injectable()
export class UserDevicesService {
    constructor(
        @InjectRepository(UserDevice)
        private deviceRepo: Repository<UserDevice>
    ) {}

    async registerDevice(payload: {
        userId: string;
        deviceToken: string;
        deviceType?: string;
    }) {
        const { userId, deviceType, deviceToken } = payload;
        const existing = await this.deviceRepo.findOne({
            where: { device_token: deviceToken }
        });
        if (existing) {
            existing.active = true;
            existing.user = { id: userId } as any;
            return this.deviceRepo.save(existing);
        }

        const newDevice = this.deviceRepo.create({
            user: { id: userId } as any,
            device_token: deviceToken,
            device_type: deviceType
        });

        return this.deviceRepo.save(newDevice);
    }

    async getTokensForUser(userId: string): Promise<string[]> {
        const devices = await this.deviceRepo.find({
            where: { user: { id: userId }, active: true }
        });
        return devices.map(d => d.device_token);
    }

    async deactivateToken(deviceToken: string) {
        const device = await this.deviceRepo.findOne({
            where: { device_token: deviceToken }
        });
        if (device) {
            device.active = false;
            await this.deviceRepo.save(device);
        }
    }
}
