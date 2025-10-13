import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as jwt from "jsonwebtoken";

export interface JwtPayload {
    userId: string;
    email?: string;
    sessionId?: string;
    [key: string]: any;
}

@Injectable()
export class JwtService {
    private readonly logger = new Logger(JwtService.name);
    private readonly secretKey: string;

    constructor(private readonly configService: ConfigService) {
        const key = this.configService.get<string>("JWT_SECRET_KEY");
        if (!key) {
            throw new Error("JWT_SECRET_KEY is missing from configuration");
        }
        this.secretKey = key;
    }

    /* ====== GENERATE TOKEN ===== */
    generateToken(payload: JwtPayload, expiresIn = "1h"): string {
        if (!payload) throw new Error("Payload is required to generate token");

        try {
            const token = jwt.sign(payload, this.secretKey, { expiresIn });
            this.logger.debug(`Token generated for userId=${payload.userId}`);
            return token;
        } catch (err) {
            this.logger.error("Failed to generate JWT", err.stack);
            throw new Error("Failed to generate JWT token");
        }
    }

    /* ====== GENERATE REFRESH TOKEN ===== */
    generateRefreshToken(payload: JwtPayload, expiresIn = "7d"): string {
        return this.generateToken(payload, expiresIn);
    }

    /* ====== VERIFY TOKEN ===== */
    verifyToken<T = JwtPayload>(token: string): T {
        if (!token) throw new UnauthorizedException("Token not provided");

        try {
            const decoded = jwt.verify(token, this.secretKey) as T;
            return decoded;
        } catch (err: any) {
            if (err.name === "TokenExpiredError") {
                this.logger.warn("Token expired");
                throw new UnauthorizedException("Token expired");
            } else if (err.name === "JsonWebTokenError") {
                this.logger.warn("Invalid token");
                throw new UnauthorizedException("Invalid token");
            } else {
                this.logger.error("JWT verification failed", err.stack);
                throw new UnauthorizedException("Failed to verify token");
            }
        }
    }

    /* ====== DECODE TOKEN (no verify) ===== */
    decodeToken(token: string): JwtPayload | null {
        try {
            return jwt.decode(token) as JwtPayload;
        } catch {
            return null;
        }
    }
}
