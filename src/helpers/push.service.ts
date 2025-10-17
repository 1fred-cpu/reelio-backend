import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { UserDevicesService } from "@modules/user-devices/user-devices.service";
import * as admin from "firebase-admin";

@Injectable()
export class PushService implements OnModuleInit {
    private readonly logger = new Logger(PushService.name);

    constructor(private readonly devicesService: UserDevicesService) {}

    onModuleInit() {
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(
                        /\\n/g,
                        "\n"
                    ),
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL
                })
            });
        }
    }

    async sendToUser(
        userId: string,
        payload: { title: string; message: string; data?: any }
    ) {
        const tokens = await this.devicesService.getTokensForUser(userId);
        if (!tokens.length) {
            this.logger.warn(`No active tokens for user ${userId}`);
            return;
        }

        const message = {
            notification: {
                title: payload.title,
                body: payload.message
            },
            data: payload.data || {},
            tokens
        };

        const response = await admin.messaging().sendMulticast(message);

        // Handle failed tokens
        response.responses.forEach((res, i) => {
            if (!res.success) {
                const token = tokens[i];
                this.logger.warn(`Invalid FCM token: ${token}`);
                this.devicesService.deactivateToken(token);
            }
        });

        this.logger.log(
            `Push sent to ${userId}: ${response.successCount} success`
        );
    }
}
