import { Injectable, Logger } from "@nestjs/common";
import { Session } from "@entities/session.entity";
import { BadRequestException } from "@exceptions/app.exception";
import { DataSource, EntityManager } from "typeorm";
import { randomUUID } from "crypto";
import { addMinutes, addDays } from "date-fns";
import { hashSync } from "bcryptjs";

@Injectable()
export class SessionService {
    private readonly logger = new Logger(SessionService.name);

    constructor(private readonly dataSource: DataSource) {}

    /* ============================================================
     * CREATE SESSION
     * ============================================================ */
    async createSession(
        manager: EntityManager,
        payload: {
            userId: string;
            ipAddress?: string;
            userAgent?: string;
            refreshToken?: string;
            accessToken?: string;
            deviceInfo?: string;
        }
    ): Promise<Session> {
        try {
            // Validate payload
            if (!payload?.userId) {
                throw new BadRequestException("User ID is required for session creation");
            }

            // Session repository (within current transaction manager)
            const sessionRepo = manager.getRepository(Session);

            // Calculate expiry times
            const accessTokenExpiry = addMinutes(new Date(), 15); // 15 minutes
            const refreshTokenExpiry = addDays(new Date(), 7); // 7 days

            // Optional hashing of refresh token before storage (for security)
            const hashedRefresh = payload.refreshToken
                ? hashSync(payload.refreshToken, 10)
                : null;

            // Create the session record
            const session = sessionRepo.create({
                id: randomUUID(),
                userId: payload.userId,
                ipAddress: payload.ipAddress || null,
                userAgent: payload.userAgent || null,
                deviceInfo: payload.deviceInfo || "Unknown Device",
                accessToken: payload.accessToken || null,
                refreshTokenHash: hashedRefresh,
                accessTokenExpiresAt: accessTokenExpiry,
                refreshTokenExpiresAt: refreshTokenExpiry,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            // Persist the session
            await sessionRepo.save(session);
            this.logger.log(`Session created for user: ${payload.userId}`);

            return session;
        } catch (error) {
            this.logger.error("Failed to create session", error.stack);
            throw error;
        }
    }

    /* ============================================================
     * UPDATE SESSION (e.g., refresh token rotation)
     * ============================================================ */
    async updateSession(
        manager: EntityManager,
        sessionId: string,
        updates: Partial<Session>
    ): Promise<Session> {
        const sessionRepo = manager.getRepository(Session);

        const session = await sessionRepo.findOne({ where: { id: sessionId } });
        if (!session) throw new BadRequestException("Session not found");

        Object.assign(session, updates, { updatedAt: new Date() });
        await sessionRepo.save(session);

        return session;
    }

    /* ============================================================
     * DEACTIVATE SESSION (Logout)
     * ============================================================ */
    async deactivateSession(
        manager: EntityManager,
        sessionId: string
    ): Promise<void> {
        const sessionRepo = manager.getRepository(Session);

        const session = await sessionRepo.findOne({ where: { id: sessionId } });
        if (!session) throw new BadRequestException("Session not found");

        session.isActive = false;
        session.updatedAt = new Date();
        await sessionRepo.save(session);

        this.logger.log(`Session deactivated: ${sessionId}`);
    }

    /* ============================================================
     * FIND ACTIVE SESSIONS (useful for dashboard)
     * ============================================================ */
    async findUserSessions(userId: string): Promise<Session[]> {
        const manager = this.dataSource.manager;
        const sessionRepo = manager.getRepository(Session);

        return sessionRepo.find({
            where: { userId, isActive: true },
            order: { createdAt: "DESC" },
        });
    }
}