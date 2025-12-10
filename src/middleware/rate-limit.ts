/**
 * Rate Limiting Middleware for Omni-Dromenon-Engine
 */

import { Request, Response, NextFunction } from 'express';

// =============================================================================
// TYPES
// =============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator: (req: Request) => string;
  handler: (req: Request, res: Response) => void;
}

// =============================================================================
// RATE LIMITER
// =============================================================================

export class RateLimiter {
  private entries: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;
  private cleanupInterval: NodeJS.Timeout;
  
  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      windowMs: config.windowMs ?? 60000,
      maxRequests: config.maxRequests ?? 100,
      keyGenerator: config.keyGenerator ?? this.defaultKeyGenerator,
      handler: config.handler ?? this.defaultHandler,
    };
    
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }
  
  private defaultKeyGenerator(req: Request): string {
    return req.ip || req.socket.remoteAddress || 'unknown';
  }
  
  private defaultHandler(req: Request, res: Response): void {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil(this.config.windowMs / 1000),
    });
  }
  
  /**
   * Check if request is allowed.
   */
  check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    let entry = this.entries.get(key);
    
    // Create new entry if doesn't exist or expired
    if (!entry || entry.resetAt <= now) {
      entry = {
        count: 0,
        resetAt: now + this.config.windowMs,
      };
      this.entries.set(key, entry);
    }
    
    entry.count++;
    
    const allowed = entry.count <= this.config.maxRequests;
    const remaining = Math.max(0, this.config.maxRequests - entry.count);
    
    return { allowed, remaining, resetAt: entry.resetAt };
  }
  
  /**
   * Get middleware function.
   */
  middleware(): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = this.config.keyGenerator(req);
      const result = this.check(key);
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', this.config.maxRequests);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));
      
      if (!result.allowed) {
        this.config.handler(req, res);
        return;
      }
      
      next();
    };
  }
  
  /**
   * Reset limit for a key.
   */
  reset(key: string): void {
    this.entries.delete(key);
  }
  
  /**
   * Cleanup expired entries.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) {
        this.entries.delete(key);
      }
    }
  }
  
  /**
   * Destroy limiter.
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.entries.clear();
  }
}

// =============================================================================
// PRE-CONFIGURED LIMITERS
// =============================================================================

/**
 * Standard API rate limiter (100 req/min).
 */
export const apiLimiter = new RateLimiter({
  windowMs: 60000,
  maxRequests: 100,
});

/**
 * Strict limiter for auth endpoints (10 req/min).
 */
export const authLimiter = new RateLimiter({
  windowMs: 60000,
  maxRequests: 10,
});

/**
 * Lenient limiter for WebSocket inputs (1000 req/min).
 */
export const inputLimiter = new RateLimiter({
  windowMs: 60000,
  maxRequests: 1000,
});

// =============================================================================
// FACTORY
// =============================================================================

export function createRateLimiter(config?: Partial<RateLimitConfig>): RateLimiter {
  return new RateLimiter(config);
}
