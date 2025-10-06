import { CustomLoggerService } from '../services/logger.service';

export interface SecurityConfig {
  helmet: {
    contentSecurityPolicy: {
      directives: Record<string, string[]>;
    };
    crossOriginEmbedderPolicy: boolean;
    crossOriginOpenerPolicy: { policy: string };
    crossOriginResourcePolicy: { policy: string };
    dnsPrefetchControl: boolean;
    frameguard: { action: string };
    hidePoweredBy: boolean;
    hsts: {
      maxAge: number;
      includeSubDomains: boolean;
      preload: boolean;
    };
    ieNoOpen: boolean;
    noSniff: boolean;
    originAgentCluster: boolean;
    permittedCrossDomainPolicies: boolean;
    referrerPolicy: { policy: string[] };
    xssFilter: boolean;
  };
}

export class SecurityConfigService {
  private static logger = (() => {
    const logger = new CustomLoggerService();
    logger.setContext('SecurityConfig');
    return logger;
  })();

  static getSecurityConfig(): SecurityConfig {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isProduction = process.env.NODE_ENV === 'production';

    const config: SecurityConfig = {
      helmet: {
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:', 'https:'],
            scriptSrc: isDevelopment 
              ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"] 
              : ["'self'"],
            connectSrc: isDevelopment 
              ? ["'self'", 'ws:', 'wss:', 'http://localhost:*', 'https://localhost:*']
              : ["'self'", 'https:'],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            manifestSrc: ["'self'"],
            workerSrc: ["'self'"],
            childSrc: ["'none'"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"],
            baseUri: ["'self'"],
            upgradeInsecureRequests: isProduction ? [] : undefined as any,
          },
        },
        crossOriginEmbedderPolicy: false, // Disable for API compatibility
        crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        dnsPrefetchControl: true,
        frameguard: { action: 'deny' },
        hidePoweredBy: true,
        hsts: {
          maxAge: 31536000, // 1 year
          includeSubDomains: true,
          preload: true,
        },
        ieNoOpen: true,
        noSniff: true,
        originAgentCluster: true,
        permittedCrossDomainPolicies: false,
        referrerPolicy: { policy: ['no-referrer', 'strict-origin-when-cross-origin'] },
        xssFilter: true,
      },
    };

    // Log security configuration
    this.logger.log('Security configuration loaded', {
      environment: process.env.NODE_ENV,
      isDevelopment,
      isProduction,
      hstsEnabled: config.helmet.hsts.maxAge > 0,
      cspEnabled: Object.keys(config.helmet.contentSecurityPolicy.directives).length > 0,
    });

    return config;
  }

  static validateSecurityConfig(): void {
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      // Warn about insecure configurations in production
      const warnings: string[] = [];
      
      if (!process.env.HTTPS) {
        warnings.push('HTTPS not enforced in production');
      }
      
      if (warnings.length > 0) {
        this.logger.warn('Security configuration warnings', {
          warnings,
          environment: 'production',
        });
      }
    }

    this.logger.log('Security configuration validated', {
      environment: process.env.NODE_ENV,
    });
  }
}
