import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { CustomLoggerService } from '../services/logger.service';

export class CorsConfig {
  private static logger = (() => {
    const logger = new CustomLoggerService();
    logger.setContext('CORS');
    return logger;
  })();

  static getCorsOptions(): CorsOptions {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isProduction = process.env.NODE_ENV === 'production';

    // Development allowed origins
    const devOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:4200',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:4200',
    ];

    // Production allowed origins from environment
    const prodOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()) || [];

    // Staging origins
    const stagingOrigins = [
      'https://bng.livex.com.co',
      'https://livex.com.co',
      'https://staging.livex.com',
      'https://staging-admin.livex.com',
    ];

    let allowedOrigins: string[] = [];

    if (isDevelopment) {
      allowedOrigins = [...devOrigins, ...stagingOrigins];
    } else if (isProduction) {
      allowedOrigins = prodOrigins;
    } else {
      // Staging environment
      allowedOrigins = [...stagingOrigins, ...devOrigins];
    }

    // Log configured origins
    this.logger.log('CORS configured with origins', {
      environment: process.env.NODE_ENV,
      allowedOrigins,
      isDevelopment,
      isProduction,
    });

    return {
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) {
          return callback(null, true);
        }

        // Check if origin is in allowed list
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        // In development, allow localhost with any port
        if (isDevelopment && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
          return callback(null, true);
        }

        // Log blocked origin
        this.logger.logSecurityEvent('CORS_ORIGIN_BLOCKED', {
          origin,
          allowedOrigins,
          environment: process.env.NODE_ENV,
        });

        callback(new Error(`Origin ${origin} not allowed by CORS policy`), false);
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-Request-Id',
        'Accept-Language',
        'Time-Zone',
        'X-API-Key',
      ],
      exposedHeaders: [
        'X-Request-Id',
        'X-Total-Count',
        'X-Page-Count',
        'X-Rate-Limit-Limit',
        'X-Rate-Limit-Remaining',
        'X-Rate-Limit-Reset',
      ],
      credentials: true,
      maxAge: 86400, // 24 hours
      optionsSuccessStatus: 200,
    };
  }

  static validateCorsConfig(): void {
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction && !process.env.CORS_ALLOWED_ORIGINS) {
      throw new Error('CORS_ALLOWED_ORIGINS environment variable is required in production');
    }

    if (isProduction) {
      const origins = process.env.CORS_ALLOWED_ORIGINS?.split(',') || [];
      const hasInsecureOrigins = origins.some(origin => origin.trim().startsWith('http://'));

      if (hasInsecureOrigins) {
        this.logger.warn('Insecure HTTP origins detected in production CORS configuration', {
          origins,
        });
      }
    }
  }
}
