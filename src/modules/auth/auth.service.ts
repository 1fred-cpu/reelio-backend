import {
    Injectable,
    Logger,
    ForbiddenException,
    UnauthorizedException,
    ConflictException,
    BadRequestException,
    NotFoundException,
    InternalServerErrorException
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
import { addDays, addHours, addMinutes, isAfter, isBefore } from "date-fns";
import { randomBytes, randomUUID } from "crypto";
import { Session } from "@entities/session.entity";
import { EntityManager } from "typeorm";
import { OAuth2Client } from "google-auth-library";
import { ConfigService } from "@nestjs/config";
import { generateRandomTokenHex } from "../../utils/token.util";
@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);
    private googleClient;

    constructor(
        private readonly dataSource: DataSource,
        private readonly sessionService: SessionService,
        private readonly jwtService: JwtService,
        private readonly mailService: MailService,
        private readonly configService: ConfigService
    ) {
        this.googleClient = new OAuth2Client(
            this.configService.get<string>("GOOGLE_CLIENT_ID")
        );
    }

    /* ===== SIGN UP ===== */
    async signup(signupDto: SignupDto, ipAddress?: string, userAgent?: string) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const { email, password, fullName } = signupDto;
            const normalizedEmail = email.trim().toLowerCase();
            const manager = queryRunner.manager;

            // 🔹 Step 1: Pre-check for existing user
            const existing = await manager.findOne(User, {
                where: { email: normalizedEmail },
                select: { id: true }
            });

            if (existing) {
                throw new ConflictException("Email already in use");
            }

            // 🔹 Step 2: Create user
            const userRepo = manager.getRepository(User);
            const user = userRepo.create({
                id: randomUUID(),
                email: normalizedEmail,
                full_name: fullName,
                role: UserRoles.VIEWER,
                auth_provider: AuthProviders.EMAIL,
                preferences: {},
                email_verified: false,
                status: AccountStatus.PENDING,
                password: hashSync(password, 10)
            });

            await userRepo.save(user);

            // 🔹 Step 3: Generate email verification token
            const { emailVerificationRaw } =
                this.handleEmailVerificationToken(user);
            await userRepo.save(user);

            // 🔹 Commit transaction before sending email
            await queryRunner.commitTransaction();

            // 🔹 Step 4: Send verification email (asynchronous, after commit)
            try {
                await this.mailService.sendEmailVerificationLink({
                    to: user.email,
                    name: user.full_name,
                    token: emailVerificationRaw
                });
            } catch (mailError) {
                this.logger.warn(
                    `Failed to send verification email to ${user.email}: ${mailError.message}`
                );
                // No rollback — user is still created successfully
            }

            // 🔹 Step 5: Return safe response
            return {
                user: {
                    id: user.id,
                    email: user.email,
                    fullName: user.full_name,
                    role: user.role,
                    avatarUrl: user.avatar_url,
                    emailVerified: user.email_verified
                },
                message: "Signup successful. Please verify your email address."
            };
        } catch (error) {
            await queryRunner.rollbackTransaction();

            // 🔸 Handle known exceptions
            if (
                error instanceof BadRequestException ||
                error instanceof ConflictException ||
                error instanceof UnauthorizedException ||
                error instanceof ForbiddenException
            ) {
                throw error;
            }

            // 🔸 Log unexpected errors
            this.logger.error("Signup transaction failed", error);
            throw new InternalServerErrorException(
                "An unexpected error occurred during signup"
            );
        } finally {
            await queryRunner.release();
        }
    }

    /* ===== SIGN IN ===== */
    async signin(signinDto: SigninDto, ipAddress?: string, userAgent?: string) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const { email, password } = signinDto;
            const normalizedEmail = email.trim().toLowerCase();
            const manager = queryRunner.manager;

            // 🔹 Step 1: Fetch user
            const user = await manager.findOne(User, {
                where: { email: normalizedEmail }
            });

            if (!user) {
                throw new UnauthorizedException("Invalid email or password");
            }

            // 🔹 Step 2: Validate password
            const isPasswordValid = compareSync(password, user.password);
            if (!isPasswordValid) {
                throw new UnauthorizedException("Invalid email or password");
            }

            // 🔹 Step 3: Check account status
            if (user.status === AccountStatus.DISABLED) {
                throw new ForbiddenException(
                    "Account has been disabled. Contact support."
                );
            }

            // 🔹 Step 4: Handle unverified email
            if (!user.email_verified) {
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

            // 🔹 Step 5: Create session
            const session = await this.handleSessionCreation(manager, {
                user,
                ipAddress,
                userAgent
            });

            // 🔹 Commit transaction
            await queryRunner.commitTransaction();

            // 🔹 Return structured response
            return {
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
        } catch (error) {
            await queryRunner.rollbackTransaction();

            // 🔸 Rethrow expected exceptions directly
            if (
                error instanceof BadRequestException ||
                error instanceof UnauthorizedException ||
                error instanceof ForbiddenException ||
                error instanceof ConflictException
            ) {
                throw error;
            }

            // 🔸 Log and wrap unexpected errors
            this.logger.error("Signin transaction failed", error);
            throw new InternalServerErrorException(
                "An unexpected error occurred during sign-in"
            );
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
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const { idToken, ipAddress, userAgent } = googlePayload;

            if (!idToken) {
                throw new BadRequestException("Google ID token is required");
            }

            // Verify Google token
            const googleUser = await this.verifyGoogleToken(idToken);
            if (!googleUser?.email) {
                throw new UnauthorizedException(
                    "Unable to verify Google token"
                );
            }

            const normalizedEmail = googleUser.email.trim().toLowerCase();
            const manager = queryRunner.manager;

            // Check if user already exists
            let user = await manager.findOne(User, {
                where: { email: normalizedEmail }
            });

            if (user) {
                // Prevent login if the account was created via email/password
                if (user.auth_provider === AuthProviders.EMAIL) {
                    throw new ConflictException(
                        "This email is already registered with a password. Please sign in using email and password."
                    );
                }
            } else {
                // Create a new user from Google data
                const userRepo = manager.getRepository(User);
                user = userRepo.create({
                    id: randomUUID(),
                    email: normalizedEmail,
                    full_name: googleUser.name || "Unnamed User",
                    avatar_url: googleUser.picture,
                    role: UserRoles.VIEWER,
                    auth_provider: AuthProviders.GOOGLE,
                    email_verified: true, // Google guarantees verified emails
                    status: AccountStatus.ACTIVE,
                    preferences: {}
                });

                await userRepo.save(user);
            }

            // Create a new session for the user
            const session = await this.handleSessionCreation(manager, {
                user,
                ipAddress,
                userAgent
            });

            await queryRunner.commitTransaction();

            return {
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
        } catch (error) {
            await queryRunner.rollbackTransaction();

            // Known handled errors are rethrown
            if (
                error instanceof BadRequestException ||
                error instanceof UnauthorizedException ||
                error instanceof ConflictException
            ) {
                throw error;
            }

            // Log and rethrow as internal error for unhandled cases
            this.logger.error("Google Sign-in transaction failed", error);
            throw new InternalServerErrorException(
                "An unexpected error occurred during Google sign-in"
            );
        } finally {
            await queryRunner.release();
        }
    }

    /* ===== VERIFY EMAIL ===== */
    async verifyEmail(token: string, ipAddress?: string, userAgent?: string) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Step 1: Validate token
            if (!token) {
                throw new BadRequestException("Verification token is required");
            }

            const manager = queryRunner.manager;

            const allUsers = await manager.find(User, {
                where: { email_verified: false }
            });

            const user = allUsers.find(u =>
                u.email_verification_token
                    ? compareSync(token, u.email_verification_token)
                    : false
            );

            if (!user) {
                throw new NotFoundException(
                    "Invalid or expired verification link"
                );
            }

            // Step 2: Check expiration
            if (
                !user.email_verification_expires_at ||
                isAfter(new Date(), user.email_verification_expires_at)
            ) {
                throw new UnauthorizedException(
                    "Verification link has expired"
                );
            }

            // Step 3: Mark user as verified
            user.email_verified = true;
            user.status = AccountStatus.ACTIVE;
            user.email_verification_token = null;
            user.email_verification_expires_at = null;
            user.email_confirmed_at = new Date();

            await manager.save(user);

            // Step 4: Create session for verified user
            const session = await this.handleSessionCreation(manager, {
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role
                },
                ipAddress,
                userAgent
            });

            // Step 5: Commit transaction
            await queryRunner.commitTransaction();

            this.logger.log(`User email verified successfully: ${user.email}`);

            // Step 6: Return structured response
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
            // Rollback first
            await queryRunner.rollbackTransaction();

            // Log with details
            this.logger.error(
                `Email verification failed for token ${token?.slice(0, 10)}...`,
                error.stack
            );

            // Known errors are re-thrown directly
            if (
                error instanceof BadRequestException ||
                error instanceof NotFoundException ||
                error instanceof UnauthorizedException
            ) {
                throw error;
            }

            // Everything else → internal server error
            throw new InternalServerErrorException(
                "An unexpected error occurred while verifying your email. Please try again later."
            );
        } finally {
            await queryRunner.release();
        }
    }
    /* ===== REFRESH ACCESS TOKEN ===== */
    async refreshAccessToken(payload: {
        userId: string;
        refreshToken: string;
        userAgent?: string;
        ipAddress?: string;
    }): Promise<{ accessToken: string; accessTokenExpiresAt: Date }> {
        try {
            if (!payload?.userId || !payload?.refreshToken) {
                throw new BadRequestException(
                    "User ID and refresh token are required"
                );
            }

            return await this.dataSource.transaction(
                async (manager: EntityManager) => {
                    const sessionRepo = manager.getRepository(Session);

                    // 🔹 1. Find active session for user
                    const session = await sessionRepo.findOne({
                        where: { user_id: payload.userId, is_active: true }
                    });

                    if (!session) {
                        throw new UnauthorizedException(
                            "No active session found for this user"
                        );
                    }

                    // 🔹 2. Validate refresh token match
                    const isValidRefresh =
                        payload.refreshToken === session.refresh_token;
                    if (!isValidRefresh) {
                        throw new UnauthorizedException(
                            "Invalid refresh token"
                        );
                    }

                    // 🔹 3. Check refresh token expiration
                    if (
                        isBefore(session.refresh_token_expires_at, new Date())
                    ) {
                        throw new UnauthorizedException(
                            "Refresh token has expired. Please log in again."
                        );
                    }

                    // 🔹 4. Generate new access token (short-lived)
                    const newAccessToken = generateRandomTokenHex(32);
                    const newAccessTokenExpiry = addMinutes(new Date(), 15); // 15 minutes

                    // 🔹 5. Rotate refresh token if it's expiring soon (< 1 day)
                    let updatedRefreshToken = session.refresh_token;
                    let newRefreshExpiry = session.refresh_token_expires_at;
                    const oneDayFromNow = new Date(
                        Date.now() + 24 * 60 * 60 * 1000
                    );

                    if (
                        isBefore(
                            session.refresh_token_expires_at,
                            oneDayFromNow
                        )
                    ) {
                        updatedRefreshToken = generateRandomTokenHex(32);
                        newRefreshExpiry = addDays(new Date(), 7); // Extend for 7 days
                        this.logger.debug(
                            `Rotated refresh token for user ${payload.userId} (near expiry).`
                        );
                    }

                    // 🔹 6. Update session fields
                    session.access_token = newAccessToken;
                    session.access_token_expires_at = newAccessTokenExpiry;
                    session.refresh_token = updatedRefreshToken;
                    session.refresh_token_expires_at = newRefreshExpiry;
                    session.ip_address =
                        payload.ipAddress || session.ip_address;
                    session.user_agent =
                        payload.userAgent || session.user_agent;
                    session.updated_at = new Date();

                    await sessionRepo.save(session);

                    this.logger.log(
                        `Access token refreshed for user: ${payload.userId}`
                    );

                    // 🔹 7. Return new tokens
                    return {
                        accessToken: newAccessToken,
                        accessTokenExpiresAt: newAccessTokenExpiry
                    };
                }
            );
        } catch (error) {
            // 🔸 Known errors are rethrown directly
            if (
                error instanceof BadRequestException ||
                error instanceof UnauthorizedException
            ) {
                throw error;
            }

            // 🔸 Log and wrap unexpected internal issues
            this.logger.error(
                `Failed to refresh access token for user ${payload.userId}: ${error.message}`,
                error.stack
            );

            throw new InternalServerErrorException(
                "An unexpected error occurred while refreshing your access token. Please try again later."
            );
        }
    }
    /* ===== REQUEST PASSWORD RESET ===== */
    async requestPasswordReset(email: string): Promise<{ message: string }> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const normalizedEmail = email.trim().toLowerCase();
            const userRepo = queryRunner.manager.getRepository(User);
            const user = await userRepo.findOne({
                where: {
                    email: normalizedEmail
                }
            });

            if (!user) {
                throw new NotFoundException("No account found with that email");
            }

            // Generate reset token and expiry
            const resetToken = generateRandomTokenHex(32);
            const expiresAt = addMinutes(new Date(), 15);

            user.password_reset_token = resetToken;
            user.password_reset_expires = expiresAt;
            await userRepo.save(user);

            // Commit before sending mail (avoid rollback delay)
            await queryRunner.commitTransaction();

            // Send password reset email
            try {
                await this.mailService.sendPasswordResetEmail(
                    user.email,
                    user.full_name,
                    resetToken
                );
                this.logger.log(`Password reset email sent to ${user.email}`);
            } catch (mailError) {
                this.logger.error(
                    "Failed to send password reset email",
                    mailError
                );
            }

            return {
                message:
                    "Password reset link has been sent to your email address"
            };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(
                "Request password reset transaction failed",
                error as any
            );

            if (error instanceof NotFoundException) throw error;
            throw new InternalServerErrorException(
                "Failed to process password reset request"
            );
        } finally {
            await queryRunner.release();
        }
    }

    /* ===== RESET PASSWORD ===== */
    async resetPassword(
        token: string,
        newPassword: string
    ): Promise<{ message: string }> {
        if (!token) throw new BadRequestException("Reset token is required");
        if (!newPassword)
            throw new BadRequestException("New password is required");

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const user = await queryRunner.manager
                .createQueryBuilder(User, "user")
                .where("user.password_reset_token = :token", { token })
                .getOne();

            if (!user) {
                throw new NotFoundException("Invalid or expired reset token");
            }

            // Check token expiry
            if (
                !user.password_reset_expires ||
                isAfter(new Date(), user.password_reset_expires)
            ) {
                throw new UnauthorizedException("Reset token has expired");
            }

            const hashedPassword = hashSync(newPassword, 10);

            await queryRunner.manager
                .createQueryBuilder()
                .update(User)
                .set({
                    password: hashedPassword,
                    password_reset_token: null,
                    password_reset_expires: null,
                    updated_at: new Date()
                })
                .where("id = :id", { id: user.id })
                .execute();

            await queryRunner.commitTransaction();

            this.logger.log(
                `Password successfully reset for user ${user.email}`
            );
            return { message: "Password has been successfully reset" };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(
                "Reset password transaction failed",
                error as any
            );

            if (
                error instanceof NotFoundException ||
                error instanceof UnauthorizedException
            ) {
                throw error;
            }

            throw new InternalServerErrorException(
                "Failed to reset password. Please try again later."
            );
        } finally {
            await queryRunner.release();
        }
    }
    /* ===== FIND USER ===== */
    async findUser(userId: string) {
        const manager = this.dataSource.manager;

        try {
            // Get user repository
            const userRepo = manager.getRepository(User);
            // Find a user
            const user = await userRepo.findOne({
                where: {
                    id: userId
                },
                select: {
                    id: true,
                    full_name: true,
                    email: true,
                    role: true,
                    preferences: true,
                    avatar_url: true
                }
            });
            if (!user) {
                throw new NotFoundException(
                    "Cannot find user with this User ID"
                );
            }
            // Normalize user data to be camelCase
            const normalizeUser = {
                ...user,
                avatarUrl: user.avatar_url,
                fullName: user.full_name
            };
            return { user: normalizeUser };
        } catch (error) {
            this.logger.error("Error finding user", error as any);

            if (error instanceof NotFoundException) {
                throw error;
            }

            throw new InternalServerErrorException(
                "Failed to find user. Please try again later."
            );
        }
    }
    /* ===== SEND EMAIL VERIFICATION ===== */
    async sendEmailVerification(email: string) {
        try {
            // Check if email is empty
            if (!email) {
                throw new BadRequestException("Email was not provided");
            }
            // Get user repository
            const userRepo = this.dataSource.getRepository(User);
            // Check if email exist with a user
            const user = await userRepo.findOne({
                where: { email },
                select: {
                    full_name: true,
                    email_verification_token: true,
                    email_verification_expires_at: true
                }
            });
            if (!user) {
                throw new UnauthorizedException("Invalid email provided");
            }
            // Creates a email verification token and return it
            const { emailVerificationRaw } =
                this.handleEmailVerificationToken(user);
            // Save changes made on user (verification token )
            await userRepo.save(user);

            // Send email verification link to email
            await this.mailService.sendEmailVerificationLink({
                to: email,
                name: user.full_name,
                token: emailVerificationRaw
            });
            return {
                message: "Email verification link has being sent to your inbox"
            };
        } catch (error) {
            if (
                error instanceof BadRequestException ||
                error instanceof UnauthorizedException
            ) {
                throw error;
            }
            this.logger.error(
                "Failed to send email verification link ",
                error as any
            );
            throw new InternalServerErrorException(
                "Failed to send email verification link"
            );
        }
    }
    /* ===== HELPERS ===== */

    /* ===== HANDLE SESSION CREATION ===== */
    async handleSessionCreation(
        manager: EntityManager,
        payload: {
            user: {
                id: string;
                role: string;
                email: string;
            };
            ipAddress?: string;
            userAgent?: string;
        }
    ): Promise<Session> {
        const sessionId = randomUUID();

        // Generate tokens (access token short-lived, refresh token)
        const accessToken = generateRandomTokenHex(32);
        const refreshToken = generateRandomTokenHex(32);
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
        const emailVerificationRaw = generateRandomTokenHex(32);
        const emailVerificationHash = hashSync(emailVerificationRaw, 10);
        const emailVerificationExpires = addHours(new Date(), 24);

        user.email_verification_token = emailVerificationHash;
        user.email_verification_expires_at = emailVerificationExpires;

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
