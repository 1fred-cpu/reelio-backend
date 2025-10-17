// src/modules/notifications/notification.processor.ts
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { RedisQueueService } from "@modules/queues/redis-queue.service";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { Notification, NotificationType } from "@entities/notification.entity";
import { PushService } from "@helpers/push.service";

@Injectable()
export class NotificationProcessor implements OnModuleInit {
    private readonly logger = new Logger(NotificationProcessor.name);

    constructor(
        private readonly redisQueue: RedisQueueService,
        private readonly pushService: PushService,
        @InjectRepository(Notification)
        private readonly notificationRepo: Repository<Notification>
    ) {}

    async onModuleInit() {
        // subscribe to notifications channel
        await this.redisQueue.subscribe(
            "notifications",
            this.handleNotificationJob.bind(this)
        );
        this.logger.log(
            "Notification processor subscribed to redis channel notifications"
        );
    }

    private async handleNotificationJob(payload: any) {
        try {
            // payload shape: { type, receiverId, notificationId, ... }
            const { type, receiverId, notificationId } = payload;

            // fetch the notification to get details
            const notif = await this.notificationRepo.findOne({
                where: { id: notificationId }
            });
            if (!notif) {
                this.logger.warn(`Notification not found: ${notificationId}`);
                return;
            }

            // Example: send push via some PushService (not implemented here)
            await this.pushService.sendToUser(
                receiverId,
                this.buildPushPayload(notif)
            );

            // mark as delivered in DB
            notif.delivered = true;
            notif.delivered_at = new Date();
            await this.notificationRepo.save(notif);

            // optionally increment unread in Redis cache (fast read)
            // await this.cache.incr(`unread:${receiverId}`);

            this.logger.log(
                `Processed notification ${notificationId} for ${receiverId}`
            );
        } catch (err) {
            this.logger.error("Failed to process notification job", err);
            // Optionally push to a dead-letter queue or re-queue (not implemented)
        }
    }

    private buildPushPayload(notification: Notification) {
        const { type, title, message, data, sender, id } = notification;

        // Default safe values
        const senderName = sender?.full_name || "Someone";

        // Different formatting depending on notification type
        let pushTitle = title;
        let pushMessage = message;

        switch (type) {
            case NotificationType.LIKE:
                pushTitle = pushTitle || "New Like";
                pushMessage = pushMessage || `${senderName} liked your post.`;
                break;

            case NotificationType.COMMENT:
                pushTitle = pushTitle || "New Comment";
                pushMessage =
                    pushMessage || `${senderName} commented on your post.`;
                break;

            case NotificationType.FOLLOW:
                pushTitle = pushTitle || "New Follower";
                pushMessage =
                    pushMessage || `${senderName} started following you.`;
                break;

            case NotificationType.SYSTEM:
                pushTitle = pushTitle || "System Update";
                pushMessage =
                    pushMessage || message || "There’s an update from Reelio.";
                break;

            default:
                pushTitle = pushTitle || "Notification";
                pushMessage =
                    pushMessage || message || "You have a new notification.";
                break;
        }

        // Build the FCM payload
        return {
            title: pushTitle,
            message: pushMessage,
            data: {
                notificationId: id,
                type,
                senderId: sender?.id,
                ...data // includes contentId, etc.
            }
        };
    }
}
