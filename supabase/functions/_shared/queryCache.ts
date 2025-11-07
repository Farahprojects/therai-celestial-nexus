// Query result caching to reduce database queries
// Uses in-memory cache with TTL for frequently accessed data

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

class QueryCache {
  private cache: Map<string, CacheEntry<any>>;
  private readonly defaultTTL = 300000; // 5 minutes default

  constructor() {
    this.cache = new Map();
  }

  /**
   * Get cached value or null if expired/missing
   */
  get<T>(key: string, ttlMs?: number): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const ttl = ttlMs || this.defaultTTL;
    const isExpired = Date.now() - entry.cachedAt > ttl;
    
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cache value
   */
  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      cachedAt: Date.now()
    });
  }

  /**
   * Delete cache entry
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}

// Singleton instance
const queryCache = new QueryCache();

// Cache key generators
export const CacheKeys = {
  conversationMetadata: (chatId: string) => `conv:meta:${chatId}`,
  conversationMode: (chatId: string) => `conv:mode:${chatId}`,
  userSubscription: (userId: string) => `user:sub:${userId}`,
  featureUsage: (userId: string, featureKey: string, period: string) => 
    `feature:${userId}:${featureKey}:${period}`,
  profileData: (profileId: string) => `profile:${profileId}`,
};

// Cache TTL constants (in milliseconds)
export const CacheTTL = {
  conversationMetadata: 300000,  // 5 minutes
  userSubscription: 600000,      // 10 minutes
  featureUsage: 60000,           // 1 minute
  profileData: 300000,           // 5 minutes
};

/**
 * Helper: Get conversation metadata with caching
 */
export async function getConversationMetadata<T>(
  chatId: string,
  fetchFn: () => Promise<T>,
  ttlMs: number = CacheTTL.conversationMetadata
): Promise<T> {
  const key = CacheKeys.conversationMetadata(chatId);
  const cached = queryCache.get<T>(key, ttlMs);
  
  if (cached !== null) {
    return cached;
  }

  const data = await fetchFn();
  queryCache.set(key, data);
  return data;
}

/**
 * Helper: Get user subscription status with caching
 */
export async function getUserSubscription<T>(
  userId: string,
  fetchFn: () => Promise<T>,
  ttlMs: number = CacheTTL.userSubscription
): Promise<T> {
  const key = CacheKeys.userSubscription(userId);
  const cached = queryCache.get<T>(key, ttlMs);
  
  if (cached !== null) {
    return cached;
  }

  const data = await fetchFn();
  queryCache.set(key, data);
  return data;
}

/**
 * Helper: Get feature usage with caching
 */
export async function getFeatureUsage<T>(
  userId: string,
  featureKey: string,
  period: string,
  fetchFn: () => Promise<T>,
  ttlMs: number = CacheTTL.featureUsage
): Promise<T> {
  const key = CacheKeys.featureUsage(userId, featureKey, period);
  const cached = queryCache.get<T>(key, ttlMs);
  
  if (cached !== null) {
    return cached;
  }

  const data = await fetchFn();
  queryCache.set(key, data);
  return data;
}

export { queryCache };
