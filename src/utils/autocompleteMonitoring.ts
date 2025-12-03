
import { safeConsoleWarn } from '@/utils/safe-logging';
// Production monitoring for Google Autocomplete functionality
export interface AutocompleteEvent {
  type: 'load_start' | 'load_success' | 'load_error' | 'fallback_used' | 'retry_attempted';
  timestamp: number;
  userAgent: string;
  isMobile: boolean;
  error?: string;
  retryCount?: number;
}

class AutocompleteMonitor {
  private events: AutocompleteEvent[] = [];
  private maxEvents = 100; // Keep last 100 events

  log(type: AutocompleteEvent['type'], data?: Partial<AutocompleteEvent>) {
    const event: AutocompleteEvent = {
      type,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
      ...data
    };

    this.events.push(event);
    
    // Keep only recent events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Log to console for debugging
    console.log(`[AutocompleteMonitor] ${type}:`, event);

    // In production, you might want to send this to analytics
    if (type === 'load_error' || type === 'fallback_used') {
      this.reportCriticalEvent(event);
    }
  }

  private reportCriticalEvent(event: AutocompleteEvent) {
    // This could send to your analytics service in production
    safeConsoleWarn('[CRITICAL] Autocomplete issue:', event);
    
    // Example: Send to analytics service
    // analytics.track('autocomplete_critical_event', event);
  }

  getStats() {
    const total = this.events.length;
    const errors = this.events.filter(e => e.type === 'load_error').length;
    const fallbacks = this.events.filter(e => e.type === 'fallback_used').length;
    const successes = this.events.filter(e => e.type === 'load_success').length;
    
    return {
      total,
      errors,
      fallbacks,
      successes,
      errorRate: total > 0 ? errors / total : 0,
      fallbackRate: total > 0 ? fallbacks / total : 0
    };
  }

  exportLogs() {
    return {
      stats: this.getStats(),
      events: this.events
    };
  }
}

export const autocompleteMonitor = new AutocompleteMonitor();
