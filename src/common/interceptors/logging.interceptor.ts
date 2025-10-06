import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { CustomLoggerService } from '../services/logger.service';

interface RequestWithUser extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
  };
  requestId?: string;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new CustomLoggerService();

  constructor() {
    this.logger.setContext('HTTP');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    // Extract request information
    const method = request.method;
    const url = request.url;
    const headers = request.headers;
    const body = request.body as Record<string, unknown> | undefined;
    const query = request.query as Record<string, unknown>;
    const params = request.params as Record<string, unknown>;
    const ip = request.ip;
    const requestId = request.requestId;
    const user = request.user;

    const userAgent = headers['user-agent'] || 'unknown';
    const contentLength = headers['content-length'] || '0';
    const acceptLanguage = headers['accept-language'];
    const timeZone = headers['time-zone'];

    // Log incoming request
    this.logger.logRequest({
      requestId,
      method,
      url,
      ip,
      userAgent,
      userId: user?.id,
      role: user?.role,
      contentLength: parseInt(contentLength, 10),
      acceptLanguage,
      timeZone,
      queryParams: Object.keys(query).length > 0 ? query : undefined,
      pathParams: Object.keys(params).length > 0 ? params : undefined,
      // Only log body for non-sensitive endpoints and if it's not too large
      body: this.shouldLogBody(method, url, body) ? body : undefined,
    });

    return next.handle().pipe(
      tap((data) => {
        const responseTime = Date.now() - startTime;
        const statusCode = response.statusCode;

        // Log successful response
        this.logger.logResponse({
          requestId,
          method,
          url,
          statusCode,
          responseTime,
          userId: user?.id,
          role: user?.role,
          ip,
          userAgent,
          responseSize: this.getResponseSize(data),
        });

        // Log performance if response time is high
        if (responseTime > 1000) {
          this.logger.logPerformance(`${method} ${url}`, responseTime, {
            requestId,
            userId: user?.id,
            statusCode,
          });
        }
      }),
      catchError((error: unknown) => {
        const responseTime = Date.now() - startTime;
        const errorObj = error as { status?: number; message?: string };
        const statusCode = errorObj.status || 500;

        // Log error response
        this.logger.logResponse({
          requestId,
          method,
          url,
          statusCode,
          responseTime,
          userId: user?.id,
          role: user?.role,
          ip,
          userAgent,
          error: errorObj.message || 'Unknown error',
        });

        // Log the error details
        if (error instanceof Error) {
          this.logger.logError(error, {
            requestId,
            method,
            url,
            userId: user?.id,
            ip,
            userAgent,
          });
        } else {
          this.logger.error('Unknown error occurred', undefined, {
            requestId,
            method,
            url,
            userId: user?.id,
            ip,
            userAgent,
            error: String(error),
          });
        }

        // Re-throw the error to maintain the error flow
        throw error;
      }),
    );
  }

  private shouldLogBody(method: string, url: string, body: unknown): boolean {
    // Don't log body for sensitive endpoints
    const sensitiveEndpoints = [
      '/auth/login',
      '/auth/register',
      '/auth/refresh',
      '/users/change-password',
      '/users/reset-password',
    ];

    if (sensitiveEndpoints.some(endpoint => url.includes(endpoint))) {
      return false;
    }

    // Don't log body for GET requests
    if (method === 'GET') {
      return false;
    }

    // Don't log if body is too large (> 1KB)
    if (body && JSON.stringify(body).length > 1024) {
      return false;
    }

    return true;
  }

  private getResponseSize(data: unknown): number {
    if (!data) return 0;
    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }
}
