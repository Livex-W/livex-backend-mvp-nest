import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ThrottlerException } from '@nestjs/throttler';
import { CustomLoggerService } from '../services/logger.service';

export interface ErrorResponse {
  code: string;
  message: string;
  details?: unknown;
  requestId: string;
  timestamp: string;
  path: string;
}

export interface ValidationErrorDetail {
  field: string;
  value: unknown;
  constraints: string[];
}

interface RequestWithUser extends Request {
  user?: {
    id: string;
    role: string;
  };
  requestId?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new CustomLoggerService();

  constructor() {
    this.logger.setContext('HttpExceptionFilter');
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithUser>();

    const requestId = request.requestId || request.headers['x-request-id'] as string || 'unknown';
    const timestamp = new Date().toISOString();
    const path = request.url;

    let status: number;
    let code: string;
    let message: string;
    let details: unknown;

    if (exception instanceof ThrottlerException) {
      // Handle rate limiting exceptions
      status = HttpStatus.TOO_MANY_REQUESTS;
      code = 'RATE_LIMITED';
      message = exception.message || 'Rate limit exceeded';
      details = {
        retryAfter: '60 seconds',
        limit: 'Check X-RateLimit-* headers',
      };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as Record<string, unknown>;
        code = this.getErrorCode(status, responseObj.error as string);
        message = (responseObj.message as string) || exception.message;
        
        // Handle validation errors specially
        if (status === 400 && Array.isArray(responseObj.message)) {
          code = 'VALIDATION_ERROR';
          message = 'Validation failed';
          details = this.formatValidationErrors(responseObj.message as string[]);
        } else {
          details = responseObj.details || responseObj.message;
        }
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
      this.logger.logError(
        exception instanceof Error ? exception : new Error(errorMessage),
        {
          requestId,
          path,
          method: request.method,
          userId: request.user?.id,
          ip: request.ip,
          userAgent: request.headers['user-agent'],
        }
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

    // Log the error response (except for validation errors which are expected)
    if (status >= 500) {
      this.logger.error(`HTTP ${status} ${code}: ${message}`, undefined, {
        requestId,
        path,
        method: request.method,
        userId: request.user?.id,
        details,
      });
    } else if (status === 429) {
      this.logger.logSecurityEvent('RATE_LIMIT_RESPONSE', {
        requestId,
        path,
        method: request.method,
        userId: request.user?.id,
        ip: request.ip,
      });
    } else {
      this.logger.warn(`HTTP ${status} ${code}: ${message}`, {
        requestId,
        path,
        method: request.method,
        userId: request.user?.id,
      });
    }

    response.status(status).json(errorResponse);
  }

  private formatValidationErrors(errors: string[]): ValidationErrorDetail[] {
    return errors.map(error => {
      // Parse class-validator error format: "property should not be empty"
      const parts = error.split(' ');
      const field = parts[0] || 'unknown';
      const constraint = parts.slice(1).join(' ') || error;
      
      return {
        field,
        value: undefined, // We don't have access to the actual value here
        constraints: [constraint],
      };
    });
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
