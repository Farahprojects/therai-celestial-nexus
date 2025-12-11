/**
 * Comprehensive environment monitoring and error catching system
 * Monitors startup, catches errors, and provides development insights
 */

import { log } from './logUtils';
import { imageCacheManager } from './storageUtils';
import { safeConsoleError } from '@/utils/safe-logging';
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

// Strategic performance analysis
interface RequestAnalysis {
  category: string;
  displayUrl: string;
  insight: string;
  strategy: string;
  actionItems: string[];
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
        safeConsoleError('🚨 Caught error:', error);
      } else {
        // In production, send to monitoring service (placeholder)
        console.error('🚨 Production error logged:', '[REDACTED ERROR OBJECT - Check for sensitive data]');
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
   * Setup development-specific monitoring with strategic performance insights
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

    // Monitor network requests in development with strategic insights
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.duration > 3000) { // Slow requests > 3 seconds
              this.analyzeSlowRequest(entry);
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
   * Analyze slow network requests and provide strategic insights
   */
  private analyzeSlowRequest(entry: PerformanceEntry): void {
    const requestAnalysis = this.categorizeAndAnalyzeRequest(entry);

    // Log strategic insights instead of just raw data
    log('warn', `🐌 ${requestAnalysis.category}: ${requestAnalysis.insight}`, {
      duration: `${entry.duration.toFixed(2)}ms`,
      url: requestAnalysis.displayUrl,
      strategy: requestAnalysis.strategy,
      actionItems: requestAnalysis.actionItems
    });

    // Track patterns for potential optimizations
    this.trackPerformancePattern(requestAnalysis);
  }

  /**
   * Categorize requests and provide strategic analysis
   */
  private categorizeAndAnalyzeRequest(entry: PerformanceEntry): RequestAnalysis {
    const url = entry.name;
    const duration = entry.duration;

    // Supabase Edge Functions
    if (url.includes('supabase.co/functions/v1/')) {
      const functionName = url.split('/functions/v1/')[1]?.split('?')[0] || 'unknown';
      return this.analyzeSupabaseFunction(functionName, duration, url);
    }

    // Supabase Database/API
    if (url.includes('supabase.co/rest/v1/') || url.includes('supabase.co/storage/v1/')) {
      return this.analyzeSupabaseAPI(duration, url);
    }

    // External APIs
    if (url.includes('googleapis.com') || url.includes('openai.com') || url.includes('anthropic.com')) {
      return this.analyzeExternalAPI(url, duration);
    }

    // Static assets
    if (url.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/i)) {
      return this.analyzeAssetRequest(url, duration);
    }

    // Navigation requests
    if (entry.entryType === 'navigation') {
      return this.analyzeNavigationRequest(url, duration);
    }

    // Generic analysis
    return {
      category: 'Network Request',
      displayUrl: url.length > 60 ? url.substring(0, 57) + '...' : url,
      insight: `Slow ${entry.entryType} request detected`,
      strategy: 'Monitor for patterns',
      actionItems: ['Check network connectivity', 'Consider caching if appropriate']
    };
  }

  /**
   * Analyze Supabase Edge Function performance
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private analyzeSupabaseFunction(functionName: string, _duration: number, _url: string): RequestAnalysis {
    const insights = {
      'chat-send': {
        insight: 'AI chat processing taking longer than expected',
        strategy: 'Potential cold start or complex AI operation',
        actionItems: ['Consider function warming', 'Optimize AI prompt complexity', 'Check OpenAI API latency']
      },
      'generate-conversation-title': {
        insight: 'AI title generation is slow',
        strategy: 'Non-blocking operation, but still impacts UX',
        actionItems: ['Consider simpler title generation', 'Cache common titles', 'Use faster AI model']
      },
      'llm-handler-gemini': {
        insight: 'Primary AI handler experiencing delays',
        strategy: 'Critical path performance issue',
        actionItems: ['Check Gemini API quotas', 'Consider response streaming', 'Implement request queuing']
      },
      'report-orchestrator': {
        insight: 'Report generation orchestration is slow',
        strategy: 'Complex multi-step process',
        actionItems: ['Optimize database queries', 'Consider async processing', 'Add progress indicators']
      },
      'create-conversation-with-title': {
        insight: 'Conversation creation with AI title is slow',
        strategy: 'Blocking user interaction',
        actionItems: ['Separate title generation from creation', 'Use optimistic updates', 'Cache conversation templates']
      }
    };

    const analysis = insights[functionName as keyof typeof insights] || {
      insight: `Edge function '${functionName}' taking longer than expected`,
      strategy: 'Check function logs and cold start patterns',
      actionItems: ['Review function code for optimizations', 'Consider function warming', 'Check Supabase function limits']
    };

    return {
      category: 'Supabase Function',
      displayUrl: `functions/${functionName}`,
      ...analysis
    };
  }

  /**
   * Analyze Supabase API/database performance
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private analyzeSupabaseAPI(_duration: number, _url: string): RequestAnalysis {
    const isStorage = url.includes('/storage/v1/');
    const isRest = url.includes('/rest/v1/');

    let insight = 'Database operation taking longer than expected';
    let strategy = 'Check query complexity and indexing';
    const actionItems = ['Review database indexes', 'Consider query optimization'];

    if (isStorage) {
      insight = 'File storage operation is slow';
      strategy = 'Potential large file or network congestion';
      actionItems.push('Check file sizes', 'Consider compression', 'Verify upload/download logic');
    } else if (isRest) {
      insight = 'REST API call is slow';
      strategy = 'Check query complexity and RLS policies';
      actionItems.push('Review Row Level Security rules', 'Check for N+1 query patterns');
    }

    return {
      category: 'Supabase API',
      displayUrl: isStorage ? 'storage/v1/*' : 'rest/v1/*',
      insight,
      strategy,
      actionItems
    };
  }

  /**
   * Analyze external API performance
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private analyzeExternalAPI(_url: string, _duration: number): RequestAnalysis {
    let insight = 'External API call is slow';
    let strategy = 'Third-party service latency';
    const actionItems = ['Check API rate limits', 'Consider response caching'];

    if (url.includes('googleapis.com')) {
      insight = 'Google API experiencing delays';
      strategy = 'Maps/places API latency or quota issues';
      actionItems.push('Check Google API quotas', 'Consider fallback providers');
    } else if (url.includes('openai.com') || url.includes('anthropic.com')) {
      insight = 'AI service API is slow';
      strategy = 'Model inference time or API congestion';
      actionItems.push('Consider model optimization', 'Implement retry logic', 'Check API tiers');
    }

    return {
      category: 'External API',
      displayUrl: url.split('/')[2], // Just the domain
      insight,
      strategy,
      actionItems
    };
  }

  /**
   * Analyze static asset performance
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private analyzeAssetRequest(_url: string, _duration: number): RequestAnalysis {
    const fileType = url.split('.').pop()?.toLowerCase();
    const insight = `Large ${fileType?.toUpperCase()} asset taking time to load`;
    const strategy = 'Asset optimization opportunity';
    const actionItems = ['Consider compression', 'Check CDN configuration'];

    if (fileType === 'js' || fileType === 'css') {
      actionItems.push('Consider code splitting', 'Minify assets', 'Use modern formats (WebP, AVIF)');
    } else if (['png', 'jpg', 'jpeg'].includes(fileType || '')) {
      actionItems.push('Optimize image sizes', 'Use WebP format', 'Implement lazy loading');
    }

    return {
      category: 'Static Asset',
      displayUrl: url.split('/').pop() || 'unknown',
      insight,
      strategy,
      actionItems
    };
  }

  /**
   * Analyze navigation performance
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private analyzeNavigationRequest(_url: string, _duration: number): RequestAnalysis {
    const insight = 'Page navigation taking longer than expected';
    const strategy = 'Check initial page load performance';
    const actionItems = [
      'Review bundle sizes',
      'Optimize critical rendering path',
      'Consider code splitting',
      'Check for blocking resources'
    ];

    return {
      category: 'Page Navigation',
      displayUrl: url.split('/').pop() || 'page',
      insight,
      strategy,
      actionItems
    };
  }

  /**
   * Track performance patterns for trend analysis
   */
  private trackPerformancePattern(analysis: RequestAnalysis): void {
    // Simple pattern tracking - could be expanded with localStorage persistence
    const patternKey = `${analysis.category}:${analysis.displayUrl}`;
    const currentTime = Date.now();

    // Store pattern data for potential future analysis
    if (typeof window !== 'undefined') {
      try {
        const patterns = JSON.parse(localStorage.getItem('performancePatterns') || '{}');
        if (!patterns[patternKey]) {
          patterns[patternKey] = { count: 0, firstSeen: currentTime, lastSeen: currentTime };
        }
        patterns[patternKey].count++;
        patterns[patternKey].lastSeen = currentTime;

        localStorage.setItem('performancePatterns', JSON.stringify(patterns));
      } catch {
        // Silently fail if localStorage is not available
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
