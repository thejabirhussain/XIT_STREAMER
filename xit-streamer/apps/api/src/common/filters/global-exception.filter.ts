import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    const correlationId = uuidv4();

    let status: number;
    let message: string;
    let code: string;
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        code = this.statusToCode(status);
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp.message as string) || exception.message;
        code = (resp.code as string) || this.statusToCode(status);
        details = resp.details;

        // Handle class-validator errors (array of messages)
        if (Array.isArray(resp.message)) {
          message = 'Validation failed';
          details = resp.message;
        }
      } else {
        message = exception.message;
        code = this.statusToCode(status);
      }
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'An unexpected error occurred. Please try again or contact support.';
      code = 'INTERNAL_ERROR';

      // Log the full error for debugging (never expose to client)
      this.logger.error(
        `[${correlationId}] Unhandled error: ${exception.message}`,
        exception.stack,
      );
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'An unexpected error occurred.';
      code = 'INTERNAL_ERROR';
    }

    // Log all errors with correlation ID
    this.logger.error(
      `[${correlationId}] ${request.method} ${request.url} → ${status} ${code}: ${message}`,
    );

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
        correlationId,
      },
    });
  }

  private statusToCode(status: number): string {
    const codeMap: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'RATE_LIMIT_EXCEEDED',
      500: 'INTERNAL_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
    };
    return codeMap[status] || 'ERROR';
  }
}
