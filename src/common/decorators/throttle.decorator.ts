import { SetMetadata } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

// Custom throttle configurations for different endpoint types
export const ThrottleConfig = {
  // Authentication endpoints - stricter limits
  AUTH: { default: { ttl: 60000, limit: 5 } }, // 5 requests per minute
  
  // Password reset/change - very strict
  PASSWORD: { default: { ttl: 300000, limit: 3 } }, // 3 requests per 5 minutes
  
  // Search and listing endpoints - moderate limits
  SEARCH: { default: { ttl: 60000, limit: 100 } }, // 100 requests per minute
  
  // File upload endpoints - moderate limits
  UPLOAD: { default: { ttl: 60000, limit: 20 } }, // 20 requests per minute
  
  // Payment endpoints - strict limits
  PAYMENT: { default: { ttl: 60000, limit: 10 } }, // 10 requests per minute
  
  // Admin endpoints - moderate limits
  ADMIN: { default: { ttl: 60000, limit: 50 } }, // 50 requests per minute
  
  // Default for other endpoints
  DEFAULT: { default: { ttl: 60000, limit: 200 } }, // 200 requests per minute
};

// Custom decorators for different endpoint types
export const ThrottleAuth = () => Throttle(ThrottleConfig.AUTH);
export const ThrottlePassword = () => Throttle(ThrottleConfig.PASSWORD);
export const ThrottleSearch = () => Throttle(ThrottleConfig.SEARCH);
export const ThrottleUpload = () => Throttle(ThrottleConfig.UPLOAD);
export const ThrottlePayment = () => Throttle(ThrottleConfig.PAYMENT);
export const ThrottleAdmin = () => Throttle(ThrottleConfig.ADMIN);

// Skip throttling for specific endpoints
export const THROTTLE_SKIP_KEY = 'throttle_skip';
export const SkipThrottle = () => SetMetadata(THROTTLE_SKIP_KEY, true);
