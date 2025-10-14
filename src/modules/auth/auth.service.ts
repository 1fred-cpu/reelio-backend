import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SignupDto } from './dto/sign-up.dto';
import {
  AccountStatus,
  AuthProviders,
  User,
  UserRoles,
} from '@entities/user.entity';
import { SessionService } from '@helpers/session.service';
import { hashSync } from 'bcryptjs';
import { MailService } from '@helpers/mail.service';
import { JwtService } from '@helpers/jwt.service';
import { addHours } from 'date-fns';
import { randomBytes, randomUUID } from 'crypto';
import { ConflictException } from '@exceptions/app.exception';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly sessionService: SessionService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Signup flow:
   * - validate uniqueness
   * - create user + session within a transaction
   * - commit
   * - send verification email asynchronously
   * - respond with tokens/session (refresh token can be in cookie)
   */
  async signup(signupDto: SignupDto, ipAddress?: string, userAgent?: string) {
    // Basic validations are done via DTO + class-validator
    const manager = this.dataSource.manager;
    const { email, password, fullName } = signupDto;

    // Normalize
    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists (quick pre-check)
    const existing = await manager.findOne(User, {
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    // QueryRunner to have full control over transaction and to handle race conditions
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // create user
      const userRepo = queryRunner.manager.getRepository(User);
      const user = userRepo.create({
        email: normalizedEmail,
        full_name: fullName,
        role: UserRoles.VIEWER,
        auth_provider: AuthProviders.EMAIL,
        preferences: {},
        email_verified: false,
        status: AccountStatus.PENDING,
        password: hashSync(password, 12),
      });

      await userRepo.save(user);
      const sessionId = randomUUID();

      // Generate tokens (access token short-lived, refresh token we already generated)
      const accessToken = this.jwtService.generateToken(
        {
          userId: user.id,
          sessionId,
          role: user.role,
          email: user.email,
        },
        '15m',
      );

      const refreshToken = this.jwtService.generateRefreshToken(
        {
          userId: user.id,
          sessionId,
          role: user.role,
          email: user.email,
        },
        '7d',
      );

      // create session and get session object
      const session = await this.sessionService.createSession(
        queryRunner.manager,
        {
          userId: user.id,
          sessionId,
          ipAddress,
          userAgent,
          refreshToken,
          accessToken,
        },
      );

      // Generate email verification token (raw), hash and store on user
      const emailVerificationRaw = this.generateRandomTokenHex(32);
      const emailVerificationHash = hashSync(emailVerificationRaw, 10);
      const emailVerificationExpires = addHours(new Date(), 24);

      user.email_verification_token = emailVerificationHash;
      user.email_verification_expires = emailVerificationExpires;

      await userRepo.save(user); // still inside same transaction

      // commit
      await queryRunner.commitTransaction();

      // AFTER commit: send verification email asynchronously (do not block)
      await this.mailService.sendEmailVerificationLink({
        to: user.email,
        name: user.full_name,
        token: emailVerificationRaw,
      });

      // Return response
      const response = {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          emailVerified: user.email_verified,
        },
        session: {
          id: session.id,
          createdAt: session.created_at.toISOString(),
          refreshTokenExpiresAt:
            session.refresh_token_expires_at?.toISOString(),
        },
        tokens: {
          accessToken,
          accessTokenExpiresAt: session.access_token_expires_at,
        },
      };

      return { response };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Signup transaction failed', error as any);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  generateRandomTokenHex(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }
}
