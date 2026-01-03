 
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Controller, Get, Header, HttpCode, HttpStatus } from '@nestjs/common';
import { MetricsService } from '../services/metrics.service';
import { CustomLoggerService } from '../services/logger.service';
import { SkipThrottle } from '../decorators/throttle.decorator';

@Controller()
export class MetricsController {
  private readonly logger = new CustomLoggerService();

  constructor(private readonly metricsService: MetricsService) {
    this.logger.setContext('MetricsController');
  }

  @Get('metrics')
  @SkipThrottle()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @HttpCode(HttpStatus.OK)
  async getMetrics(): Promise<string> {
    try {
      const metrics = await this.metricsService.getMetrics();

      this.logger.debug('Metrics endpoint accessed', {
        metricsSize: metrics.length,
      });

      return metrics;
    } catch (error) {
      this.logger.logError(error as Error, {
        endpoint: '/metrics',
      });
      throw error;
    }
  }

  @Get('metrics/json')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  async getMetricsAsJson(): Promise<any> {
    try {
      const metrics = await this.metricsService.getMetricsAsJson();

      this.logger.debug('Metrics JSON endpoint accessed', {
        metricsCount: metrics.length,
      });

      return {
        timestamp: new Date().toISOString(),
        metrics,
      };
    } catch (error) {
      this.logger.logError(error as Error, {
        endpoint: '/metrics/json',
      });
      throw error;
    }
  }

  @Get('health')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  getHealth(): any {
    try {
      const healthMetrics = this.metricsService.getHealthMetrics();

      // Determine health status based on memory usage
      const memoryUsage = healthMetrics.memory as any;
      const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

      const status = memoryUsagePercent > 90 ? 'unhealthy' : 'healthy';

      const response = {
        status,
        timestamp: new Date().toISOString(),
        service: 'livex-backend',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        ...healthMetrics,
        checks: {
          memory: {
            status: memoryUsagePercent > 90 ? 'fail' : 'pass',
            usage_percent: Math.round(memoryUsagePercent * 100) / 100,
          },
          uptime: {
            status: 'pass',
            seconds: healthMetrics.uptime,
          },
        },
      };

      this.logger.debug('Health check performed', {
        status,
        memoryUsagePercent: Math.round(memoryUsagePercent * 100) / 100,
        uptime: healthMetrics.uptime,
      });

      return response;
    } catch (error) {
      this.logger.logError(error as Error, {
        endpoint: '/health',
      });

      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'livex-backend',
        error: (error as Error).message,
      };
    }
  }

  @Get('health/ready')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  getReadiness(): any {
    try {
      // Check if the application is ready to serve requests
      // This could include database connectivity, external service checks, etc.

      const checks = {
        database: { status: 'pass' }, // TODO: Add actual database check
        storage: { status: 'pass' },  // TODO: Add actual storage check
        memory: { status: 'pass' },
      };

      const allPassing = Object.values(checks).every(check => check.status === 'pass');
      const status = allPassing ? 'ready' : 'not_ready';

      const response = {
        status,
        timestamp: new Date().toISOString(),
        service: 'livex-backend',
        checks,
      };

      this.logger.debug('Readiness check performed', {
        status,
        checks,
      });

      return response;
    } catch (error) {
      this.logger.logError(error as Error, {
        endpoint: '/health/ready',
      });

      return {
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        service: 'livex-backend',
        error: (error as Error).message,
      };
    }
  }

  @Get('health/live')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  getLiveness(): any {
    try {
      // Simple liveness check - if we can respond, we're alive
      const response = {
        status: 'alive',
        timestamp: new Date().toISOString(),
        service: 'livex-backend',
        uptime: process.uptime(),
      };

      return response;
    } catch (error) {
      this.logger.logError(error as Error, {
        endpoint: '/health/live',
      });

      return {
        status: 'dead',
        timestamp: new Date().toISOString(),
        service: 'livex-backend',
        error: (error as Error).message,
      };
    }
  }
}
