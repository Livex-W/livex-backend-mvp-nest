import { Injectable } from '@nestjs/common';
import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly httpRequestsTotal: Counter<string>;
  private readonly httpRequestDuration: Histogram<string>;
  private readonly httpRequestsInFlight: Gauge<string>;
  private readonly businessEventsTotal: Counter<string>;
  private readonly authenticationAttemptsTotal: Counter<string>;
  private readonly rateLimitHitsTotal: Counter<string>;

  constructor() {
    // Collect default metrics (CPU, memory, etc.)
    collectDefaultMetrics({ register });

    // HTTP request metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'user_role'],
      registers: [register],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
      registers: [register],
    });

    this.httpRequestsInFlight = new Gauge({
      name: 'http_requests_in_flight',
      help: 'Number of HTTP requests currently being processed',
      registers: [register],
    });

    // Business metrics
    this.businessEventsTotal = new Counter({
      name: 'business_events_total',
      help: 'Total number of business events',
      labelNames: ['event_type', 'status'],
      registers: [register],
    });

    // Security metrics
    this.authenticationAttemptsTotal = new Counter({
      name: 'authentication_attempts_total',
      help: 'Total number of authentication attempts',
      labelNames: ['method', 'status', 'user_agent'],
      registers: [register],
    });

    this.rateLimitHitsTotal = new Counter({
      name: 'rate_limit_hits_total',
      help: 'Total number of rate limit hits',
      labelNames: ['endpoint', 'user_type'],
      registers: [register],
    });
  }

  // HTTP request metrics
  incrementHttpRequests(method: string, route: string, statusCode: number, userRole?: string): void {
    this.httpRequestsTotal
      .labels(method, route, statusCode.toString(), userRole || 'anonymous')
      .inc();
  }

  recordHttpRequestDuration(method: string, route: string, statusCode: number, duration: number): void {
    this.httpRequestDuration
      .labels(method, route, statusCode.toString())
      .observe(duration / 1000); // Convert to seconds
  }

  incrementHttpRequestsInFlight(): void {
    this.httpRequestsInFlight.inc();
  }

  decrementHttpRequestsInFlight(): void {
    this.httpRequestsInFlight.dec();
  }

  // Business event metrics
  recordBusinessEvent(eventType: string, status: 'success' | 'failure'): void {
    this.businessEventsTotal.labels(eventType, status).inc();
  }

  // Security metrics
  recordAuthenticationAttempt(method: string, status: 'success' | 'failure', userAgent?: string): void {
    this.authenticationAttemptsTotal
      .labels(method, status, userAgent || 'unknown')
      .inc();
  }

  recordRateLimitHit(endpoint: string, userType: 'authenticated' | 'anonymous'): void {
    this.rateLimitHitsTotal.labels(endpoint, userType).inc();
  }

  // Get metrics in Prometheus format
  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  // Get metrics as JSON for debugging
  async getMetricsAsJson(): Promise<any> {
    const metrics = await register.getMetricsAsJSON();
    return metrics;
  }

  // Health check metrics
  getHealthMetrics(): Record<string, unknown> {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    return {
      uptime: uptime,
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers,
      },
      cpu: process.cpuUsage(),
      version: process.version,
      platform: process.platform,
      arch: process.arch,
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    };
  }

  // Reset all metrics (useful for testing)
  reset(): void {
    register.clear();
  }
}
