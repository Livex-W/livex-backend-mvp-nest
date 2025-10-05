import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ErrorResponse {
  code: string;
  message: string;
  details?: unknown;
  requestId: string;
  timestamp: string;
  path: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = request.headers['x-request-id'] as string || 'unknown';
    const timestamp = new Date().toISOString();
    const path = request.url;

    let status: number;
    let code: string;
    let message: string;
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as Record<string, unknown>;
        code = this.getErrorCode(status, responseObj.error as string);
        message = (responseObj.message as string) || exception.message;
        details = responseObj.details || responseObj.message;
      } else {
        code = this.getErrorCode(status);
        message = String(exceptionResponse);
      }
    } else {
      // Unhandled exceptions
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'INTERNAL_ERROR';
      message = 'Internal server error';
      
      // Log the full error for debugging
      const errorMessage = exception instanceof Error ? exception.message : String(exception);
      this.logger.error(
        `Unhandled exception: ${errorMessage}`,
        exception instanceof Error ? exception.stack : undefined,
        { requestId, path },
      );
    }

    const errorResponse: ErrorResponse = {
      code,
      message,
      details,
      requestId,
      timestamp,
      path,
    };

    // Log the error response
    this.logger.error(
      `HTTP ${status} ${code}: ${message}`,
      { requestId, path, details },
    );

    response.status(status).json(errorResponse);
  }

  private getErrorCode(status: number, error?: string): string {
    const statusCode = status as HttpStatus;
    switch (statusCode) {
      case HttpStatus.BAD_REQUEST:
        return error === 'Bad Request' ? 'VALIDATION_ERROR' : 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'BUSINESS_RULE_VIOLATION';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMITED';
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'INTERNAL_ERROR';
      default:
        return 'UNKNOWN_ERROR';
    }
  }
}
