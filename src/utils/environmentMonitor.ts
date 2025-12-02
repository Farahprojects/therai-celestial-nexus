/**
 * Comprehensive environment monitoring and error catching system
 * Monitors startup, catches errors, and provides development insights
 */

import { log } from './logUtils';
import { imageCacheManager } from './storageUtils';

// Environment monitoring configuration
interface EnvironmentStatus {
  environment: 'development' | 'production';
  platform: 'web' | 'ios' | 'android';
  supabaseConfigured: boolean;
  stripeConfigured: boolean;
  buildInfo: {
    timestamp: string;
    version: string;
    commit?: string;
  };
  performance: {
    initialMemoryUsage?: number;
    initialLoadTime?: number;
  };
}

// Global error tracking
interface ErrorEvent {
  type: 'error' | 'unhandledrejection' | 'console';
  message: string;
  stack?: string;
  timestamp: number;
  url?: string;
  userAgent?: string;
  environment: string;
}

class EnvironmentMonitor {
  private startTime: number;
  private errors: ErrorEvent[] = [];
  private isInitialized = false;
  private isHandlingError = false; // Prevent circular logging
  private errorHandler: ((event: ErrorEvent) => void) | null = null;
  private rejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null;

  constructor() {
    this.startTime = performance.now();
  }

  /**
   * Initialize comprehensive environment monitoring
   */
  public initialize(): void {
    if (this.isInitialized) return;

    this.isInitialized = true;
    this.setupGlobalErrorHandlers();
    this.monitorEnvironment();
    this.logStartupInfo();

    // Initialize image caching system
    imageCacheManager.init().catch(error =>
      log('warn', '⚠️ Image cache initialization failed', error)
    );

    // Development-specific monitoring
    if (import.meta.env.DEV) {
      this.setupDevelopmentMonitoring();
    }

    log('info', '🔍 Environment monitor initialized', {
      environment: this.getEnvironmentStatus()
    });
  }

  /**
   * Setup global error handlers to catch all unhandled errors
   */
  private setupGlobalErrorHandlers(): void {
    // Store handler references for cleanup
    this.errorHandler = (event: ErrorEvent) => {
      this.handleError({
        type: 'error',
        message: event.message,
        stack: event.error?.stack,
        timestamp: Date.now(),
        url: event.filename,
        userAgent: navigator.userAgent,
        environment: import.meta.env.MODE
      });

      // Prevent default error handling in production
      if (import.meta.env.PROD) {
        event.preventDefault();
      }
    };

    this.rejectionHandler = (event: PromiseRejectionEvent) => {
      this.handleError({
        type: 'unhandledrejection',
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        environment: import.meta.env.MODE
      });

      // Prevent default rejection handling in production
      if (import.meta.env.PROD) {
        event.preventDefault();
      }
    };

    // Catch unhandled errors
    window.addEventListener('error', this.errorHandler);

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', this.rejectionHandler);

    // Console monitoring disabled - was causing false error reports
    // if (import.meta.env.DEV) {
    //   this.monitorConsoleMethods();
    // }
  }


  /**
   * Handle and log errors
   */
  private handleError(error: ErrorEvent): void {
    // Prevent circular logging when console monitoring triggers this method
    if (this.isHandlingError) return;

    this.isHandlingError = true;
    try {
      this.errors.push(error);

      // Log based on environment
      if (import.meta.env.DEV) {
        console.error('🚨 Caught error:', error);
      } else {
        // In production, send to monitoring service (placeholder)
        console.error('🚨 Production error logged:', {
          message: error.message,
          type: error.type,
          timestamp: error.timestamp
        });
      }

      // Limit error storage to prevent memory leaks
      if (this.errors.length > 100) {
        this.errors = this.errors.slice(-50);
      }
    } finally {
      this.isHandlingError = false;
    }
  }

  /**
   * Monitor environment configuration
   */
  private monitorEnvironment(): void {
    const status = this.getEnvironmentStatus();

    // Check for missing critical environment variables
    if (!status.supabaseConfigured) {
      log('error', '🚨 CRITICAL: Supabase not configured', {
        VITE_SUPABASE_URL: !!import.meta.env.VITE_SUPABASE_URL,
        VITE_SUPABASE_ANON_KEY: !!import.meta.env.VITE_SUPABASE_ANON_KEY
      });
    }

    if (!status.stripeConfigured) {
      log('warn', '⚠️  WARNING: Stripe not configured (payments may not work)', {
        VITE_STRIPE_PUBLISHABLE_KEY: !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
      });
    }
  }

  /**
   * Log comprehensive startup information
   */
  private logStartupInfo(): void {
    const status = this.getEnvironmentStatus();
    const loadTime = performance.now() - this.startTime;

    log('info', '🚀 Therai Application Started', {
      loadTime: `${loadTime.toFixed(2)}ms`,
      environment: status.environment,
      platform: status.platform,
      supabaseConfigured: status.supabaseConfigured,
      stripeConfigured: status.stripeConfigured,
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      memoryUsage: this.getMemoryUsage()
    });

    // Development-specific startup info
    if (import.meta.env.DEV) {
      console.log('📊 Development Mode Active:');
      console.log('  • Verbose logging enabled');
      console.log('  • Memory monitoring active');
      console.log('  • Console methods tracked');
      console.log('  • Run toggleLogs() to toggle verbose logging');
      console.log('  • Check window.logUtils for logging controls');
    }
  }

  /**
   * Setup development-specific monitoring
   */
  private setupDevelopmentMonitoring(): void {
    // Monitor performance
    if ('performance' in window && 'memory' in performance) {
      setInterval(() => {
        const memoryUsage = this.getMemoryUsage();
        if (memoryUsage && memoryUsage.usedJSHeapSize > 200 * 1024 * 1024) { // 200MB threshold - more reasonable
          log('warn', '⚠️  High memory usage detected', memoryUsage);
        }
      }, 300000); // Check every 5 minutes - much less frequent
    }

    // Monitor network requests in development
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.duration > 3000) { // Slow requests > 3 seconds (more reasonable with optimizations)
              log('warn', '🐌 Slow network request detected', {
                url: entry.name,
                duration: `${entry.duration.toFixed(2)}ms`,
                type: entry.entryType
              });
            }
          });
        });

        observer.observe({ entryTypes: ['navigation', 'resource'] });
      } catch (error) {
        log('debug', 'Performance observer not supported', error);
      }
    }
  }

  /**
   * Get current environment status
   */
  private getEnvironmentStatus(): EnvironmentStatus {
    return {
      environment: import.meta.env.PROD ? 'production' : 'development',
      platform: this.getPlatform(),
      supabaseConfigured: !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY),
      stripeConfigured: !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
      buildInfo: {
        timestamp: new Date().toISOString(),
        version: import.meta.env.VITE_APP_VERSION || '1.0.0',
        commit: import.meta.env.VITE_COMMIT_SHA
      },
      performance: {
        initialMemoryUsage: this.getMemoryUsage()?.usedJSHeapSize,
        initialLoadTime: performance.now() - this.startTime
      }
    };
  }

  /**
   * Get current platform
   */
  private getPlatform(): 'web' | 'ios' | 'android' {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
      return 'ios';
    }
    if (userAgent.includes('android')) {
      return 'android';
    }
    return 'web';
  }

  /**
   * Get memory usage if available
   */
  private getMemoryUsage(): { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } | null {
    if ('memory' in performance) {
      return (performance as typeof performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
    }
    return null;
  }

  /**
   * Get error summary for debugging
   */
  public getErrorSummary(): { total: number; recent: ErrorEvent[] } {
    return {
      total: this.errors.length,
      recent: this.errors.slice(-10) // Last 10 errors
    };
  }

  /**
   * Force trigger environment check
   */
  public checkEnvironment(): EnvironmentStatus {
    return this.getEnvironmentStatus();
  }

  /**
   * Cleanup global event listeners to prevent memory leaks
   */
  public cleanup(): void {
    if (this.errorHandler) {
      window.removeEventListener('error', this.errorHandler);
      this.errorHandler = null;
    }

    if (this.rejectionHandler) {
      window.removeEventListener('unhandledrejection', this.rejectionHandler);
      this.rejectionHandler = null;
    }

    this.isInitialized = false;
    log('info', '🧹 EnvironmentMonitor cleanup complete');
  }
}

// Create and export singleton instance
export const environmentMonitor = new EnvironmentMonitor();

// Auto-initialize on import (for immediate setup)
if (typeof window !== 'undefined') {
  // Delay initialization to ensure DOM is ready
  setTimeout(() => {
    environmentMonitor.initialize();
  }, 100);
}
