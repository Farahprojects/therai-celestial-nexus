// Application-level rate limiting using in-memory counters
// Prevents abuse and ensures fair usage across users

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry>;

  constructor() {
    this.limits = new Map();
    // Cleanup expired entries every 5 minutes
    setInterval(() => this.cleanup(), 300000);
  }

  /**
   * Check if rate limit is exceeded
   * @param key - Unique identifier (e.g., "user:{userId}:chat")
   * @param maxRequests - Maximum requests allowed
   * @param windowMs - Time window in milliseconds
   * @returns true if limit exceeded, false otherwise
   */
  isLimitExceeded(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = this.limits.get(key);

    // No entry or expired - create new
    if (!entry || now >= entry.resetAt) {
      this.limits.set(key, {
        count: 1,
        resetAt: now + windowMs
      });
      return false;
    }

    // Increment counter
    entry.count++;
    
    // Check if limit exceeded
    if (entry.count > maxRequests) {
      return true;
    }

    return false;
  }

  /**
   * Get current count for a key
   */
  getCount(key: string): number {
    const entry = this.limits.get(key);
    if (!entry || Date.now() >= entry.resetAt) {
      return 0;
    }
    return entry.count;
  }

  /**
   * Get time until reset in seconds
   */
  getTimeUntilReset(key: string): number {
    const entry = this.limits.get(key);
    if (!entry || Date.now() >= entry.resetAt) {
      return 0;
    }
    return Math.ceil((entry.resetAt - Date.now()) / 1000);
  }

  /**
   * Manually reset a key
   */
  reset(key: string): void {
    this.limits.delete(key);
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now >= entry.resetAt) {
        this.limits.delete(key);
      }
    }
  }

  /**
   * Get total entries (for monitoring)
   */
  size(): number {
    return this.limits.size;
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();

// Rate limit configurations
export const RateLimits = {
  // Chat messages: 60 per hour per user
  CHAT_MESSAGES: {
    maxRequests: 60,
    windowMs: 3600000, // 1 hour
    keyPrefix: "chat"
  },
  
  // Image generation: 3 per day per user (also enforced in DB)
  IMAGE_GENERATION: {
    maxRequests: 3,
    windowMs: 86400000, // 24 hours
    keyPrefix: "image"
  },
  
  // Memory extraction: 100 per day per user
  MEMORY_EXTRACTION: {
    maxRequests: 100,
    windowMs: 86400000, // 24 hours
    keyPrefix: "memory"
  },
  
  // API calls (general): 1000 per hour per user
  API_CALLS: {
    maxRequests: 1000,
    windowMs: 3600000, // 1 hour
    keyPrefix: "api"
  }
};

/**
 * Check rate limit for a user action
 * @param userId - User identifier
 * @param limitConfig - Rate limit configuration
 * @returns Object with isExceeded flag and retry info
 */
export function checkRateLimit(
  userId: string,
  limitConfig: typeof RateLimits[keyof typeof RateLimits]
): { isExceeded: boolean; retryAfter?: number; count?: number } {
  const key = `${limitConfig.keyPrefix}:${userId}`;
  const isExceeded = rateLimiter.isLimitExceeded(
    key,
    limitConfig.maxRequests,
    limitConfig.windowMs
  );

  if (isExceeded) {
    return {
      isExceeded: true,
      retryAfter: rateLimiter.getTimeUntilReset(key),
      count: rateLimiter.getCount(key)
    };
  }

  return {
    isExceeded: false,
    count: rateLimiter.getCount(key)
  };
}

/**
 * Reset rate limit for a user (admin use)
 */
export function resetRateLimit(
  userId: string,
  limitType: keyof typeof RateLimits
): void {
  const key = `${RateLimits[limitType].keyPrefix}:${userId}`;
  rateLimiter.reset(key);
}

export { rateLimiter };

