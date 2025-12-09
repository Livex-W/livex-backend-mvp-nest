import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import { CustomLoggerService } from '../services/logger.service';

interface RequestWithId extends FastifyRequest {
  requestId?: string;
}

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  private readonly logger = new CustomLoggerService();

  constructor() {
    this.logger.setContext('RequestId');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<RequestWithId>();
    const response = context.switchToHttp().getResponse<FastifyReply>();

    const xRequestIdHeader = request.headers['x-request-id'];
    const headerValue = Array.isArray(xRequestIdHeader)
      ? xRequestIdHeader[0]
      : xRequestIdHeader;

    const requestId = typeof headerValue === 'string' && headerValue.length > 0
      ? headerValue
      : randomUUID();

    // Set request ID in headers for response (FastifyReply)
    response.header('X-Request-Id', requestId);

    // Add request ID to request object for logging
    request.requestId = requestId;

    // Log request ID generation for debugging
    if (!headerValue) {
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
