import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { CustomLoggerService } from '../services/logger.service';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  private readonly logger = new CustomLoggerService();

  constructor() {
    this.logger.setContext('RequestId');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Generate or use existing request ID
    const requestId = (request.headers['x-request-id'] as string) || randomUUID();
    
    // Set request ID in headers for response
    response.setHeader('X-Request-Id', requestId);
    
    // Add request ID to request object for logging
    (request as Request & { requestId: string }).requestId = requestId;

    // Log request ID generation for debugging
    if (!request.headers['x-request-id']) {
      this.logger.debug('Generated new request ID', {
        requestId,
        method: request.method,
        url: request.url,
        ip: request.ip,
      });
    }

    return next.handle();
  }
}
