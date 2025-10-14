import {
    Injectable,
    Logger,
    ForbiddenException,
    UnauthorizedException,
    ConflictException,
    BadRequestException,
    NotFoundException
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { SignupDto } from "./dto/sign-up.dto";
import { SigninDto } from "./dto/sign-in.dto";
import {
    AccountStatus,
    AuthProviders,
    User,
    UserRoles
} from "@entities/user.entity";
import { SessionService } from "@helpers/session.service";
import { hashSync, compareSync } from "bcryptjs";
import { MailService } from "@helpers/mail.service";
import { JwtService } from "@helpers/jwt.service";
import { addHours, isAfter } from "date-fns";
import { randomBytes, randomUUID } from "crypto";
import { Session } from "@entities/session.entity";
import { EntityManager } from "typeorm";
import { OAuth2Client } from "google-auth-library";
import { ConfigService } from "@nestjs/config";
@Injectable()
export class AuthService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly sessionService: SessionService,
        private readonly jwtService: JwtService,
        private readonly mailService: MailService,
        private readonly configService: ConfigService
    ) {}
    private readonly logger = new Logger(AuthService.name);
    private googleClient = new OAuth2Client(
        this.configService.get<string>("GOOGLE_CLIENT_ID")
    );
    /* ===== SIGN UP ===== */
    async signup(signupDto: SignupDto, ipAddress?: string, userAgent?: string) {
        // Basic validations are done via DTO + class-validator
        const manager = this.dataSource.manager;
        const { email, password, fullName } = signupDto;

        // Normalize
        const normalizedEmail = email.trim().toLowerCase();

        // Check if user already exists (quick pre-check)
        const existing = await manager.findOne(User, {
            where: { email: normalizedEmail },
            select: { id: true }
        });
        if (existing) {
            throw new ConflictException("Email already in use");
        }

        // QueryRunner to have full control over transaction and to handle race conditions
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // create user
            const userRepo = queryRunner.manager.getRepository(User);
            const user = userRepo.create({
                id: randomUUID(),
                email: normalizedEmail,
                full_name: fullName,
                role: UserRoles.VIEWER,
                auth_provider: AuthProviders.EMAIL,
                preferences: {},
                email_verified: false,
                status: AccountStatus.PENDING,
                password: hashSync(password, 12)
            });

            await userRepo.save(user);

            // Create's session and return accessToken and refreshToken
            // const session = await this.handleSessionCreation(
            //     queryRunner.manager,
            //     {
            //         user,
            //         ipAddress,
            //         userAgent
            //     }
            // );

            // Generate email verification token , hash and store on user and return emailVerificationRaw
            const { emailVerificationRaw } =
                this.handleEmailVerificationToken(user);

            // Save updated changes made (email verification token on user )
            await userRepo.save(user);

            // commit
            await queryRunner.commitTransaction();

            // AFTER commit: send verification email asynchronously
            await this.mailService.sendEmailVerificationLink({
                to: user.email,
                name: user.full_name,
                token: emailVerificationRaw
            });

            // Return response
            const response = {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                role: user.role,
                avatarUrl: user.avatar_url,
                emailVerified: user.email_verified
            };

            return { user: response };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error("Signup transaction failed", error as any);
            throw error;
        } finally {
            await queryRunner.release();
        }
    }
    /* ===== SIGN IN ===== */
    async signin(signinDto: SigninDto, ipAddress?: string, userAgent?: string) {
        const { email, password } = signinDto;
        const manager = this.dataSource.manager;
        const normalizedEmail = email.trim().toLowerCase();

        // Fetch user
        const user = await manager.findOne(User, {
            where: { email: normalizedEmail },
            relations: []
        });

        if (!user) {
            throw new UnauthorizedException("Invalid email or password");
        }

        // Check password
        const isPasswordValid = compareSync(password, user.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException("Invalid email or password");
        }

        // Check if account is disabled or banned
        if (user.status === AccountStatus.DISABLED) {
            throw new ForbiddenException(
                "Account has been disabled. Contact support."
            );
        }

        // Handle unverified email
        if (!user.email_verified) {
            // Generate a new verification token and send again
            const { emailVerificationRaw } =
                this.handleEmailVerificationToken(user);
            await manager.save(user);

            await this.mailService.sendEmailVerificationLink({
                to: user.email,
                name: user.full_name,
                token: emailVerificationRaw
            });

            throw new ForbiddenException(
                "Email not verified. A new verification link has been sent to your email."
            );
        }

        // Use a QueryRunner for safe transaction
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Create session for the user
            const session = await this.handleSessionCreation(
                queryRunner.manager,
                {
                    user,
                    ipAddress,
                    userAgent
                }
            );

            // Commit the transaction
            await queryRunner.commitTransaction();

            // Return structured response
            const response = {
                user: {
                    id: user.id,
                    email: user.email,
                    fullName: user.full_name,
                    role: user.role,
                    avatarUrl: user.avatar_url,
                    emailVerified: user.email_verified
                },
                session: {
                    id: session.id,
                    accessToken: session.access_token,
                    accessTokenExpiresAt:
                        session.access_token_expires_at.toISOString(),
                    refreshToken: session.refresh_token,
                    refreshTokenExpiresAt:
                        session.refresh_token_expires_at?.toISOString(),
                    createdAt: session.created_at.toISOString()
                }
            };

            return { response };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error("Signin transaction failed", error as any);
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /* ===== SIGN IN WITH GOOGLE ===== */
    async signinWithGoogle(googlePayload: {
        idToken: string;
        ipAddress?: string;
        userAgent?: string;
    }) {
        const { idToken, ipAddress, userAgent } = googlePayload;

        if (!idToken) {
            throw new BadRequestException("Google ID token is required");
        }

        //  Verify the Google ID Token
        const googleUser = await this.verifyGoogleToken(idToken);
        if (!googleUser?.email) {
            throw new UnauthorizedException("Unable to verify Google token");
        }

        const normalizedEmail = googleUser.email.trim().toLowerCase();
        const manager = this.dataSource.manager;

        // 2️⃣ Check if user exists
        let user = await manager.findOne(User, {
            where: { email: normalizedEmail }
        });

        // 3️⃣ Handle existing user
        if (user) {
            // (Optional) Block if the user signed up with password and not Google
            if (user.auth_provider === AuthProviders.EMAIL) {
                throw new ConflictException(
                    "This email is already registered with a password. Please sign in using email and password."
                );
            }

            // Existing Google user → continue to session creation
        } else {
            // 4⃣ New user → create one
            const userRepo = manager.getRepository(User);
            user = userRepo.create({
                id: randomUUID(),
                email: normalizedEmail,
                full_name: googleUser.name || "Unnamed User",
                avatar_url: googleUser.picture,
                role: UserRoles.VIEWER,
                auth_provider: AuthProviders.GOOGLE,
                email_verified: true, // Google guarantees verified email
                status: AccountStatus.ACTIVE,
                preferences: {}
            });

            await userRepo.save(user);
        }

        //  Create session within transaction
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const session = await this.handleSessionCreation(
                queryRunner.manager,
                {
                    user,
                    ipAddress,
                    userAgent
                }
            );

            await queryRunner.commitTransaction();

            //  Return response
            const response = {
                user: {
                    id: user.id,
                    email: user.email,
                    fullName: user.full_name,
                    role: user.role,
                    emailVerified: user.email_verified,
                    avatarUrl: user.avatar_url
                },
                session: {
                    id: session.id,
                    accessToken: session.access_token,
                    accessTokenExpiresAt:
                        session.access_token_expires_at.toISOString(),
                    refreshToken: session.refresh_token,
                    refreshTokenExpiresAt:
                        session.refresh_token_expires_at?.toISOString(),
                    createdAt: session.created_at.toISOString()
                }
            };

            return { response };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error("Google signin transaction failed", error as any);
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /* ===== VERIFY EMAIL ===== */
    async verifyEmail(token: string, ipAddress?: string, userAgent?: string) {
        if (!token)
            throw new BadRequestException("Verification token is required");

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const manager = queryRunner.manager;
            const hashedToken = hashSync(token, 10);

            // Look for user with matching hashed token
            const user = await manager.findOne(User, {
                where: { email_verification_token: hashedToken }
            });

            if (!user) {
                throw new NotFoundException(
                    "Invalid or expired verification link"
                );
            }

            // Check expiration
            if (
                !user.email_verification_expires_at ||
                isAfter(new Date(), user.email_verification_expires_at)
            ) {
                throw new UnauthorizedException(
                    "Verification link has expired"
                );
            }

            // Mark user as verified
            user.email_verified = true;
            user.status = AccountStatus.ACTIVE;
            user.email_verification_token = null;
            user.email_verification_expires_at = null;

            await manager.save(user);

            // Create session now that user is verified
            const session = await this.sessionService.createSession(manager, {
                user,
                ipAddress,
                userAgent
            });
            // Commit
            await queryRunner.commitTransaction();

            // Return response
            return {
                message: "Email successfully verified",
                user: {
                    id: user.id,
                    email: user.email,
                    fullName: user.full_name,
                    role: user.role,
                    emailVerified: user.email_verified
                },
                session: {
                    id: session.id,
                    accessToken: session.access_token,
                    accessTokenExpiresAt:
                        session.access_token_expires_at.toISOString(),
                    refreshToken: session.refresh_token,
                    refreshTokenExpiresAt:
                        session.refresh_token_expires_at?.toISOString(),
                    createdAt: session.created_at.toISOString()
                }
            };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error("Google signin transaction failed", error as any);
            throw error;
        } finally {
            await queryRunner.release();
        }
    }
    /* ===== HELPERS ===== */
    generateRandomTokenHex(length: number = 32): string {
        return randomBytes(length).toString("hex");
    }

    /* ===== HANDLE SESSION CREATION ===== */
    async handleSessionCreation(
        manager: EntityManager,
        payload: Record<string, any>
    ): Promise<Session> {
        const sessionId = randomUUID();

        // Generate tokens (access token short-lived, refresh token)
        const accessToken = this.jwtService.generateToken(
            {
                userId: payload.user.id,
                sessionId,
                role: payload.user.role,
                email: payload.user.email
            },
            "15m"
        );

        const refreshToken = this.jwtService.generateRefreshToken(
            {
                userId: payload.user.id,
                sessionId,
                role: payload.user.role,
                email: payload.user.email
            },
            "7d"
        );

        // create session and get session object
        const session = await this.sessionService.createSession(manager, {
            userId: payload.user.id,
            sessionId,
            ipAddress: payload.ipAddress,
            userAgent: payload.userAgent,
            refreshToken,
            accessToken
        });

        return session;
    }

    /* ===== HANDLE EMAIL VERIFICATION TOKEN ===== */
    private handleEmailVerificationToken(user: User) {
        const emailVerificationRaw = this.generateRandomTokenHex(32);
        const emailVerificationHash = hashSync(emailVerificationRaw, 10);
        const emailVerificationExpires = addHours(new Date(), 24);

        user.email_verification_token = emailVerificationHash;
        user.email_verification_expires = emailVerificationExpires;

        return { emailVerificationRaw };
    }

    private async verifyGoogleToken(idToken: string) {
        try {
            const ticket = await this.googleClient.verifyIdToken({
                idToken,
                audience: this.configService.get<string>("GOOGLE_CLIENT_ID")
            });

            const payload = ticket.getPayload();

            return {
                email: payload?.email,
                name: payload?.name,
                picture: payload?.picture,
                emailVerified: payload?.email_verified,
                sub: payload?.sub // Google user ID
            };
        } catch (err) {
            this.logger.error("Invalid Google ID token", err);
            throw new UnauthorizedException(
                "Invalid Google authentication token"
            );
        }
    }
}
