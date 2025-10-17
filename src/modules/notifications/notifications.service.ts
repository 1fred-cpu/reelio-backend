import {
    Injectable,
    Logger,
    InternalServerErrorException
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { Notification, NotificationType } from "@entities/notification.entity";
0;
import { RedisQueueService } from "@modules/queues/redis-queue.service";
import { NotificationGateway } from "./notifications.gateway";
import { User } from "@entities/user.entity";

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);

    constructor(
        @InjectRepository(Notification)
        private readonly notificationRepo: Repository<Notification>,

        @InjectRepository(User)
        private readonly userRepo: Repository<User>,

        private readonly redisQueue: RedisQueueService,
        private readonly gateway: NotificationGateway,
        private readonly dataSource: DataSource
    ) {}

    /**
     * Creates a "like" notification safely with transaction and queue handling.
     */
    async createLikeNotification(
        senderId: string,
        receiverId: string,
        contentId: string
    ) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Fetch sender details (to include name or username)
            const sender = await this.userRepo.findOne({
                where: { id: senderId },
                select: ["id", "full_name"]
            });

            if (!sender) {
                throw new InternalServerErrorException("Sender not found");
            }

            // Build a clean, consistent message and title
            const senderName = sender.full_name;
            const title = "New like on your video";
            const message = `${senderName} liked your video`;

            // Create notification entity
            const notification = queryRunner.manager.create(Notification, {
                sender_id: senderId,
                receiver_id: receiverId,
                type: NotificationType.LIKE,
                title,
                message,
                data: {
                    contentId
                }
            });

            const saved = (await queryRunner.manager.save(
                notification
            )) as Notification;

            await queryRunner.commitTransaction();

            // Push to Redis for background delivery
            await this.redisQueue.publish("notifications", {
                type: NotificationType.LIKE,
                receiverId,
                notificationId: saved.id
            });

            // Emit real-time update immediately
            this.gateway.emitToUser(receiverId, {
                type: NotificationType.LIKE,
                title,
                message,
                senderId,
                contentId,
                createdAt: saved.created_at
            });

            return saved;
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(
                "Failed to create like notification",
                error.stack
            );
            throw new InternalServerErrorException(
                "Unable to create notification"
            );
        } finally {
            await queryRunner.release();
        }
    }
}
