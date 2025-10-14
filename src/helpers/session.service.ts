import { Injectable, Logger } from '@nestjs/common';
import { Session } from '@entities/session.entity';
import { BadRequestException } from '@exceptions/app.exception';
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'crypto';
import { addMinutes, addDays } from 'date-fns';
import { hashSync } from 'bcryptjs';

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
      sessionId: string;
      ipAddress?: string;
      userAgent?: string;
      refreshToken?: string;
      accessToken?: string;
    },
  ): Promise<Session> {
    try {
      // Validate payload
      if (!payload?.userId) {
        throw new BadRequestException(
          'User ID is required for session creation',
        );
      }

      // Session repository (within current transaction manager)
      const sessionRepo = manager.getRepository(Session);

      // Calculate expiry times
      const accessTokenExpiry = addMinutes(new Date(), 15); // 15 minutes
      const refreshTokenExpiry = addDays(new Date(), 7); // 7 days

      // Create the session record
      const session = sessionRepo.create({
        id: payload.sessionId,
        user_id: payload.userId,
        ip_address: payload.ipAddress,
        user_agent: payload.userAgent,
        access_token: payload.accessToken,
        refresh_token: payload.refreshToken,
        access_token_expires_at: accessTokenExpiry,
        refresh_token_expires_at: refreshTokenExpiry,
        is_active: true,
      });

      // Persist the session
      await sessionRepo.save(session);
      this.logger.log(`Session created for user: ${payload.userId}`);

      return session;
    } catch (error) {
      this.logger.error('Failed to create session', error.stack);
      throw error;
    }
  }

  /* ============================================================
   * UPDATE SESSION (e.g., refresh token rotation)
   * ============================================================ */
  async updateSession(
    manager: EntityManager,
    sessionId: string,
    updates: Partial<Session>,
  ): Promise<Session> {
    // Session repository (within current transaction manager)
    const sessionRepo = manager.getRepository(Session);

    // Find the session with sessionId
    const session = await sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new BadRequestException('Session not found');

    Object.assign(session, updates, { updatedAt: new Date() });
    // Save updated changes made
    await sessionRepo.save(session);

    return session;
  }

  /* ============================================================
   * DEACTIVATE SESSION (Logout)
   * ============================================================ */
  async deactivateSession(
    manager: EntityManager,
    sessionId: string,
  ): Promise<void> {
    // Session repository (within current transaction manager)
    const sessionRepo = manager.getRepository(Session);

    // Find the session with sessionId
    const session = await sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new BadRequestException('Session not found');

    session.is_active = false;
    session.updated_at = new Date();
    // Save updated changes made
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
      where: { user_id: userId, is_active: true },
      order: { created_at: 'DESC' },
    });
  }
}
