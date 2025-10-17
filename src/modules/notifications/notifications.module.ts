import { Module } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";
import { RedisQueueModule } from "@modules/queues/redis-queue.module";
import { NotificationGateway } from "./notifications.gateway";
import { NotificationProcessor } from "./notifications.processor";
import { PushService } from "@helpers/push.service";
import { User } from "@entities/user.entity";
import { Notification } from "@entities/notification.entity";
import { TypeOrmModule } from "@nestjs/typeorm";
@Module({
    imports: [RedisQueueModule, TypeOrmModule.forFeature([User, Notification])],
    controllers: [NotificationsController],
    providers: [
        NotificationsService,
        NotificationGateway,
        NotificationProcessor,
        PushService
    ]
})
export class NotificationsModule {}
