import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger
} from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";
import { PostgrestError } from "@supabase/supabase-js";

/**
 * 🌍 Global filter that catches all thrown errors (system, database, or app)
 * and transforms them into consistent HTTP responses.
 * Compatible with FastifyAdapter.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<FastifyReply>();
        const request = ctx.getRequest<FastifyRequest>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = "An unexpected error occurred";
        let details: any = undefined;

        //  Handle known error types
        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const res = exception.getResponse();

            if (typeof res === "string") message = res;
            else if (typeof res === "object" && (res as any).message)
                message = (res as any).message;

            details = (exception as any).details || undefined;
        }

        // ️ Handle Supabase Postgres errors
        else if (exception instanceof PostgrestError) {
            status = HttpStatus.INTERNAL_SERVER_ERROR;
            message = "Database operation failed";
            details = exception.message;
        }

        //  Handle generic JS errors
        else if (exception instanceof Error) {
            message = exception.message || message;
            details = exception.stack;
        }

        // 🪵 Log error for server visibility
        this.logger.error({
            message,
            status,
            details,
            method: request.method,
            url: request.url,
            timestamp: new Date().toISOString()
        });

        // 🌐 Send structured Fastify response
        response.status(status).send({
            success: false,
            statusCode: status,
            message,
            details:
                process.env.NODE_ENV === "development" ? details : undefined,
            timestamp: new Date().toISOString(),
            path: request.url
        });
    }
}
