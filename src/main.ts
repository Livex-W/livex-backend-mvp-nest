import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DatabaseClient } from './database/database.client';
import { DatabaseConfig } from './database/database.config';
import { CustomLoggerService } from './common/services/logger.service';
import { CorsConfig } from './common/config/cors.config';
import { SecurityConfigService } from './common/config/security.config';

import helmet from 'helmet';
import * as swaggerUi from 'swagger-ui-express';
import openapi from '@livex/contracts/openapi';

async function bootstrap() {
  // Initialize logger
  const logger = new CustomLoggerService();
  logger.setContext('Bootstrap');

  try {
    // Validate configurations
    CorsConfig.validateCorsConfig();
    SecurityConfigService.validateSecurityConfig();

    // Initialize database
    const dbConfig = DatabaseConfig.fromEnv();
    const dbClient = await DatabaseClient.initialize(dbConfig);

    // Create NestJS application
    const nestLogger = new CustomLoggerService();
    nestLogger.setContext('NestApplication');
    const app = await NestFactory.create(AppModule, {
      logger: nestLogger,
    });

    // Enable shutdown hooks
    app.enableShutdownHooks();

    // Security middleware - Helmet
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    }));

    // CORS configuration
    const corsOptions = CorsConfig.getCorsOptions();
    app.enableCors(corsOptions);

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        disableErrorMessages: process.env.NODE_ENV === 'production',
      }),
    );

    // API documentation
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi, {
      customSiteTitle: 'LIVEX API Documentation',
      customfavIcon: '/favicon.ico',
      customCss: '.swagger-ui .topbar { display: none }',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
      },
    }));

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.log(`Received ${signal}, starting graceful shutdown...`);

      try {
        await app.close();
        await dbClient.disconnect();
        logger.log('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.logError(error as Error, { signal });
        process.exit(1);
      }
    };

    process.once('SIGINT', () => void shutdown('SIGINT'));
    process.once('SIGTERM', () => void shutdown('SIGTERM'));

    // Start server
    const port = process.env.PORT ?? 3000;
    await app.listen(port);

    logger.log('Application started successfully', {
      port,
      environment: process.env.NODE_ENV,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    });

    // Log important URLs
    const baseUrl = `http://localhost:${port}`;
    logger.log('Important endpoints', {
      api: `${baseUrl}/v1`,
      docs: `${baseUrl}/docs`,
      health: `${baseUrl}/health`,
      metrics: `${baseUrl}/metrics`,
    });

  } catch (error) {
    logger.logError(error as Error, {
      context: 'bootstrap',
    });
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown) => {
  const logger = new CustomLoggerService();
  logger.setContext('UnhandledRejection');
  const reasonStr = reason instanceof Error ? reason.message : String(reason);
  logger.logError(new Error(`Unhandled Rejection: ${reasonStr}`), {
    promise: 'Promise rejected',
    reason: reasonStr,
  });
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  const logger = new CustomLoggerService();
  logger.setContext('UncaughtException');
  logger.logError(error, {
    context: 'uncaughtException',
  });
  process.exit(1);
});

void bootstrap();
