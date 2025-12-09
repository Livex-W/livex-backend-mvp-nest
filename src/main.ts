import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DatabaseClient } from './database/database.client';
import { DatabaseConfig } from './database/database.config';
import { CustomLoggerService } from './common/services/logger.service';
import { CorsConfig } from './common/config/cors.config';
import { SecurityConfigService } from './common/config/security.config';

import helmet from '@fastify/helmet';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
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
    const app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter(),
      { logger: nestLogger },
    );

    // Enable shutdown hooks
    app.enableShutdownHooks();

    // Security middleware - Helmet
    app.register(helmet, {
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
    });

    // CORS configuration
    const corsOptions = CorsConfig.getCorsOptions();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    app.register(require('@fastify/cors'), corsOptions)

    // Multipart support (file uploads)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    await app.register(require('@fastify/multipart'), {
      attachFieldsToBody: 'keyValues',
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
      },
    });

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        disableErrorMessages: process.env.NODE_ENV === 'production',
      }),
    );

    // 1. Registrar la definición de la API
    await app.register(fastifySwagger, {
      mode: 'static',
      specification: {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        document: openapi as any, // Tu objeto JSON importado
      },
    });

    // 2. Registrar la interfaz gráfica
    app.register(fastifySwaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
        displayRequestDuration: true,
      },
      staticCSP: true, // Importante para que funcione con Helmet
      theme: {
        title: 'LIVEX API Documentation',
        favicon: [
          {
            filename: 'favicon.png',
            rel: 'icon',
            sizes: '16x16',
            type: 'image/png',
            content: '/favicon.ico',
          }
        ],
        css: [
          {
            filename: 'livex-theme.css',
            content: '.swagger-ui .topbar { display: none }'
          }
        ],
      }
    });

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
    await app.listen(port, '0.0.0.0');

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
