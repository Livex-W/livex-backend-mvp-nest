import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

export interface LogContext {
  requestId?: string;
  userId?: string;
  role?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
  userAgent?: string;
  ip?: string;
  [key: string]: unknown;
}

@Injectable()
export class CustomLoggerService implements LoggerService {
  private readonly winston: winston.Logger;
  private context?: string;

  constructor() {
    this.winston = this.createWinstonLogger();
  }

  private createWinstonLogger(): winston.Logger {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

    const formats = [
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    ];

    // Add colorize and simple format for development
    if (isDevelopment) {
      formats.push(
        winston.format.colorize({ all: true }),
        winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
          const contextStr = context ? `[${String(context)}] ` : '';
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${String(timestamp)} ${String(level)}: ${contextStr}${String(message)}${metaStr}`;
        }),
      );
    }

    const transports: winston.transport[] = [
      new winston.transports.Console({
        level: logLevel,
        format: winston.format.combine(...formats),
      }),
    ];

    // Add file transports for production
    if (!isDevelopment) {
      // General application logs
      transports.push(
        new winston.transports.DailyRotateFile({
          filename: 'logs/application-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '14d',
          level: 'info',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      );

      // Error logs
      transports.push(
        new winston.transports.DailyRotateFile({
          filename: 'logs/error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '30d',
          level: 'error',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      );

      // Access logs for HTTP requests
      transports.push(
        new winston.transports.DailyRotateFile({
          filename: 'logs/access-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '7d',
          level: 'http',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      );
    }

    return winston.createLogger({
      level: logLevel,
      format: winston.format.combine(...formats),
      transports,
      exitOnError: false,
    });
  }

  setContext(context: string): void {
    this.context = context;
  }

  log(message: string, context?: string | LogContext): void {
    const contextObj = typeof context === 'string' ? { contextOverride: context } : context;
    this.winston.info(message, {
      context: this.context,
      ...contextObj,
    });
  }

  error(message: string, trace?: string, context?: string | LogContext): void {
    const contextObj = typeof context === 'string' ? { contextOverride: context } : context;
    this.winston.error(message, {
      context: this.context,
      trace,
      ...contextObj,
    });
  }

  warn(message: string, context?: string | LogContext): void {
    const contextObj = typeof context === 'string' ? { contextOverride: context } : context;
    this.winston.warn(message, {
      context: this.context,
      ...contextObj,
    });
  }

  debug(message: string, context?: string | LogContext): void {
    const contextObj = typeof context === 'string' ? { contextOverride: context } : context;
    this.winston.debug(message, {
      context: this.context,
      ...contextObj,
    });
  }

  verbose(message: string, context?: LogContext): void {
    this.winston.verbose(message, {
      context: this.context,
      ...context,
    });
  }

  // HTTP access logging
  http(message: string, context: LogContext): void {
    this.winston.log('http', message, {
      context: this.context,
      ...context,
    });
  }

  // Structured logging methods
  logRequest(context: LogContext): void {
    this.http('HTTP Request', {
      type: 'request',
      ...context,
    });
  }

  logResponse(context: LogContext): void {
    this.http('HTTP Response', {
      type: 'response',
      ...context,
    });
  }

  logError(error: Error, context?: LogContext): void {
    this.error(error.message, error.stack, {
      type: 'error',
      errorName: error.name,
      ...context,
    });
  }

  logBusinessEvent(event: string, data: Record<string, unknown>, context?: LogContext): void {
    this.log(`Business Event: ${event}`, {
      type: 'business_event',
      event,
      data,
      ...context,
    });
  }

  logSecurityEvent(event: string, context: LogContext): void {
    this.warn(`Security Event: ${event}`, {
      type: 'security_event',
      event,
      ...context,
    });
  }

  logPerformance(operation: string, duration: number, context?: LogContext): void {
    this.log(`Performance: ${operation}`, {
      type: 'performance',
      operation,
      duration,
      ...context,
    });
  }
}
