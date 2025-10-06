import { Injectable, ExecutionContext, CanActivate } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Request } from 'express';
import { CustomLoggerService } from '../services/logger.service';

interface RequestWithUser extends Request {
  user?: {
    id: string;
    role: string;
  };
  requestId?: string;
}

@Injectable()
export class CustomThrottlerGuard implements CanActivate {
  private readonly logger = new CustomLoggerService();

  constructor() {
    this.logger.setContext('RateLimit');
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    // Skip rate limiting for admin users in development
    if (process.env.NODE_ENV === 'development' && request.user?.role === 'admin') {
      return true;
    }

    // Skip for health check endpoints
    const healthEndpoints = ['/health', '/metrics', '/docs'];
    if (healthEndpoints.some(endpoint => request.url.startsWith(endpoint))) {
      return true;
    }

    // For now, just log the request and allow it
    // In a real implementation, you would check against a rate limiting store
    this.logger.debug('Rate limit check', {
      requestId: request.requestId,
      method: request.method,
      url: request.url,
      userId: request.user?.id,
      ip: request.ip,
    });

    return true;
  }

  private getTracker(req: RequestWithUser): string {
    // Use user ID if authenticated, otherwise use IP
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }

    // Get real IP considering proxies
    const forwarded = req.headers['x-forwarded-for'] as string;
    const realIp = forwarded ? forwarded.split(',')[0].trim() : req.ip;

    return `ip:${realIp}`;
  }

  private throwThrottlingException(request: RequestWithUser): void {
    const tracker = this.getTracker(request);

    // Log rate limit violation
    this.logger.logSecurityEvent('RATE_LIMIT_EXCEEDED', {
      requestId: request.requestId,
      method: request.method,
      url: request.url,
      tracker,
      userId: request.user?.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    throw new ThrottlerException('Rate limit exceeded. Please try again later.');
  }
}
