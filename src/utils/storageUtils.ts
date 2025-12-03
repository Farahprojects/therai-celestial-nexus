import { supabase } from '@/integrations/supabase/client';
import { safeConsoleWarn } from '@/utils/safe-logging';
/**
 * Image preloader for faster loading of generated images
 */
class ImagePreloader {
  private preloadQueue: Set<string> = new Set();
  private maxConcurrentPreloads = 3;
  private activePreloads = 0;

  preloadImage(url: string): void {
    if (this.preloadQueue.has(url) || this.activePreloads >= this.maxConcurrentPreloads) {
      return;
    }

    this.preloadQueue.add(url);
    this.activePreloads++;

    const img = new Image();
    img.onload = () => {
      this.activePreloads--;
      this.preloadQueue.delete(url);
      // Process next image in queue
      this.processQueue();
    };

    img.onerror = () => {
      this.activePreloads--;
      this.preloadQueue.delete(url);
      // Process next image in queue
      this.processQueue();
    };

    img.src = url;
  }

  private processQueue(): void {
    if (this.activePreloads < this.maxConcurrentPreloads && this.preloadQueue.size > 0) {
      const nextUrl = this.preloadQueue.values().next().value;
      if (nextUrl) {
        this.preloadQueue.delete(nextUrl);
        this.preloadImage(nextUrl);
      }
    }
  }

  preloadRecentImages(imageUrls: string[]): void {
    // Only preload if network conditions are good
    if (!networkAwareLoader.shouldPreload()) {
      return;
    }

    // Preload up to 3 most recent images on slower networks, 5 on fast networks
    const maxPreload = networkAwareLoader.isSlowNetwork() ? 3 : 5;
    const recentImages = imageUrls.slice(0, maxPreload);

    // Use cache manager for professional caching
    imageCacheManager.preloadCriticalImages(recentImages).catch(error =>
      safeConsoleWarn('Image preload failed:', error)
    );

    // Fallback to basic preloading
    recentImages.forEach(url => this.preloadImage(url));
  }
}

export const imagePreloader = new ImagePreloader();

/**
 * Network-aware image loading utility
 */
// Network Information API type
interface NetworkInformation {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

export class NetworkAwareImageLoader {
  private connection: NetworkInformation | null = null;
  private slowNetworkThreshold = 1000; // 1Mbps threshold

  constructor() {
    // Check for Network Information API support
    if ('connection' in navigator) {
      this.connection = (navigator as { connection?: NetworkInformation }).connection || null;
    }
  }

  isSlowNetwork(): boolean {
    if (!this.connection) return false;

    // Check effective type (4g, 3g, 2g, slow-2g)
    const effectiveType = this.connection.effectiveType;
    if (effectiveType && (effectiveType === 'slow-2g' || effectiveType === '2g')) {
      return true;
    }

    // Check downlink speed (Mbps)
    const downlink = this.connection.downlink;
    if (downlink && downlink < this.slowNetworkThreshold) {
      return true;
    }

    return false;
  }

  shouldPreload(): boolean {
    return !this.isSlowNetwork();
  }

  getOptimalImageSize(): { width: number; height: number } {
    if (this.isSlowNetwork()) {
      return { width: 512, height: 512 }; // Smaller for slow networks
    }
    return { width: 1024, height: 1024 }; // Full size for fast networks
  }
}

export const networkAwareLoader = new NetworkAwareImageLoader();

/**
 * Professional Image Service Worker Cache Manager
 * Implements advanced caching strategies for images
 */
export class ImageCacheManager {
  private cacheName = 'therai-images-v1';
  private maxCacheSize = 50; // Max images to cache
  private cacheExpirationDays = 7; // Cache for 7 days

  async init(): Promise<void> {
    if ('serviceWorker' in navigator && 'caches' in window) {
      try {
        // Register service worker for image caching
        await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered for image caching');

        // Clean up old caches
        await this.cleanupOldCaches();
      } catch (error) {
        safeConsoleWarn('Service Worker registration failed:', error);
      }
    }
  }

  async cacheImage(url: string): Promise<void> {
    if (!('caches' in window)) return;

    try {
      const cache = await caches.open(this.cacheName);
      const response = await fetch(url);

      if (response.ok) {
        // Add cache headers
        const responseClone = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: {
            ...Object.fromEntries(response.headers),
            'sw-cache-time': Date.now().toString(),
            'sw-cache-strategy': 'image-optimization'
          }
        });

        await cache.put(url, responseClone);
        await this.enforceCacheSize();
      }
    } catch (error) {
      safeConsoleWarn('Failed to cache image:', url, error);
    }
  }

  async getCachedImage(url: string): Promise<Response | null> {
    if (!('caches' in window)) return null;

    try {
      const cache = await caches.open(this.cacheName);
      const cachedResponse = await cache.match(url);

      if (cachedResponse) {
        // Check if cache is still valid
        const cacheTime = cachedResponse.headers.get('sw-cache-time');
        if (cacheTime) {
          const age = Date.now() - parseInt(cacheTime);
          const maxAge = this.cacheExpirationDays * 24 * 60 * 60 * 1000;

          if (age > maxAge) {
            // Cache expired, remove it
            await cache.delete(url);
            return null;
          }
        }
        return cachedResponse;
      }
    } catch (error) {
      safeConsoleWarn('Failed to get cached image:', url, error);
    }

    return null;
  }

  private async enforceCacheSize(): Promise<void> {
    if (!('caches' in window)) return;

    try {
      const cache = await caches.open(this.cacheName);
      const keys = await cache.keys();

      if (keys.length > this.maxCacheSize) {
        // Remove oldest entries (simple FIFO)
        const toDelete = keys.slice(0, keys.length - this.maxCacheSize);
        await Promise.all(toDelete.map(key => cache.delete(key)));
      }
    } catch (error) {
      safeConsoleWarn('Failed to enforce cache size:', error);
    }
  }

  private async cleanupOldCaches(): Promise<void> {
    if (!('caches' in window)) return;

    try {
      const cacheNames = await caches.keys();
      const oldCaches = cacheNames.filter(name =>
        name.startsWith('therai-images-') && name !== this.cacheName
      );

      await Promise.all(oldCaches.map(name => caches.delete(name)));
    } catch (error) {
      safeConsoleWarn('Failed to cleanup old caches:', error);
    }
  }

  // Preload critical images
  async preloadCriticalImages(urls: string[]): Promise<void> {
    const preloadPromises = urls.map(async (url) => {
      // Check cache first
      const cached = await this.getCachedImage(url);
      if (!cached) {
        await this.cacheImage(url);
      }
    });

    await Promise.allSettled(preloadPromises);

    // Add resource hints for critical images
    this.addResourceHints(urls.slice(0, 3)); // Hint for first 3 images
  }

  // Add resource hints for critical images
  private addResourceHints(urls: string[]): void {
    if (typeof document === 'undefined') return;

    urls.forEach(url => {
      // Add preload link for critical images
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      link.fetchPriority = 'high';

      // Add WebP hint if possible
      if (url.includes('.webp')) {
        link.type = 'image/webp';
      }

      document.head.appendChild(link);
    });
  }
}

export const imageCacheManager = new ImageCacheManager();

/**
 * Normalizes storage URLs to use the correct Supabase domain and removes double slashes
 */
export const normalizeStorageUrl = (url: string): string => {
  if (!url || typeof url !== 'string') return url;
  
  // If it's already using the correct domain, just fix double slashes
  if (url.includes('api.therai.co')) {
    return url.replace(/\/\/+/g, '/').replace(':/', '://');
  }
  
  // Extract the storage path from external URLs
  const storageMatch = url.match(/\/storage\/v1\/object\/public\/([^?]+)/);
  if (storageMatch) {
    const [, fullPath] = storageMatch;
    const pathParts = fullPath.split('/');
    const bucketName = pathParts[0];
    const filePath = pathParts.slice(1).join('/').replace(/\/+/g, '/'); // Remove double slashes
    
    // Use Supabase client to get the correct public URL
    const { data } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);
    
    return data.publicUrl;
  }
  
  return url;
};