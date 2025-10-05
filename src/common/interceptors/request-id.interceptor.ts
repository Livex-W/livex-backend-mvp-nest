import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Generate or use existing request ID
    const requestId = (request.headers['x-request-id'] as string) || randomUUID();
    
    // Set request ID in headers for response
    response.setHeader('X-Request-Id', requestId);
    
    // Add request ID to request object for logging
    (request as Request & { requestId: string }).requestId = requestId;

    return next.handle();
  }
}
