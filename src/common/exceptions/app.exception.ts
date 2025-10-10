import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * Base application exception extending NestJS HttpException.
 * All custom errors should extend this class.
 */
export class AppException extends HttpException {
    public readonly details?: string;
    public readonly context?: Record<string, any>;

    constructor(
        message: string,
        statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
        details?: string,
        context?: Record<string, any>
    ) {
        super(message, statusCode);
        this.details = details;
        this.context = context;
    }
}

/** 🧩 Specific Custom Error Types */
export class ValidationException extends AppException {
    constructor(details?: string) {
        super("Validation failed", HttpStatus.BAD_REQUEST, details);
    }
}

export class AuthException extends AppException {
    constructor(details?: string) {
        super("Authentication error", HttpStatus.UNAUTHORIZED, details);
    }
}

export class ForbiddenException extends AppException {
    constructor(details?: string) {
        super("Forbidden access", HttpStatus.FORBIDDEN, details);
    }
}

export class NotFoundException extends AppException {
    constructor(details?: string) {
        super("Resource not found", HttpStatus.NOT_FOUND, details);
    }
}

export class DatabaseException extends AppException {
    constructor(details?: string) {
        super(
            "Database operation failed",
            HttpStatus.INTERNAL_SERVER_ERROR,
            details
        );
    }
}

export class ConflictException extends AppException {
    constructor(details?: string) {
        super("Conflict error", HttpStatus.CONFLICT, details);
    }
}
